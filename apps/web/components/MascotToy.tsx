"use client";

import { cx } from "@app/ui";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";
import { MASCOT_TOY_HEIGHT } from "./MascotAnchor";
import { onMascotMoodChange, useMascotStage } from "./mascotStage";

const JUMP_MS = 1000;
const MARGIN = 24;
// au-delà de ce déplacement (px), c'est un glisser et pas un clic
const DRAG_THRESHOLD = 4;
// bulle : affichée 3,5 s, et une phrase spontanée toutes les 20 à 40 s
const BUBBLE_MS = 3500;
const CHATTER_MIN_MS = 20_000;
const CHATTER_MAX_MS = 40_000;
// temps laissé à la page suivante pour réserver sa place avant que la mascotte reparte au coin
const RELEASE_MS = 1500;

/** Distance au bord droit et au bas de la fenêtre. */
type Position = { right: number; bottom: number };
const CORNER: Position = { right: MARGIN, bottom: MARGIN };

/** Garde la mascotte entièrement dans la fenêtre. */
function clamp(pos: Position, el: HTMLElement | null): Position {
  const { width, height } = el?.getBoundingClientRect() ?? { width: 0, height: 0 };
  return {
    right: Math.min(Math.max(0, pos.right), Math.max(0, window.innerWidth - width)),
    bottom: Math.min(Math.max(0, pos.bottom), Math.max(0, window.innerHeight - height)),
  };
}

/** Position qui pose la mascotte sur la place réservée, ou null si elle n'est pas affichée. */
function anchorPosition(anchor: HTMLElement): Position | null {
  const rect = anchor.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom };
}

/**
 * La mascotte flottante, par-dessus les pages (masquée sur petit écran, où elle cacherait la
 * page) : elle respire et cligne des yeux ; un clic la fait sauter de joie. Par défaut en bas à
 * droite de l'écran ; quand une page lui réserve une place (MascotAnchor : coin du cadre « Apps »
 * de l'accueil, sous le podium de TROIS), elle y glisse et prend l'humeur demandée. On la déplace
 * en la faisant glisser (sauf sur une place fixe) ; à chaque changement de page qui réserve ou
 * libère une place, elle reprend sa place par défaut.
 */
export function MascotToy() {
  const [jumping, setJumping] = useState(false);
  const [free, setFree] = useState<Position>(CORNER);
  const [anchored, setAnchored] = useState<Position | null>(null);
  // décrochée de sa place réservée (déplaçable) en la faisant glisser
  const [detached, setDetached] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const { anchor, mood, movable, chatty } = useMascotStage();
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; from: Position; moved: boolean } | null>(null);
  const dragged = useRef(false);

  // Place réservée : on la suit à chaque image (défilement, redimensionnement, colonne sticky).
  // Quand elle disparaît (changement de page), la mascotte reste où elle est un instant : si la page
  // suivante lui réserve une place, elle y va directement, sinon elle repart au coin en bas à
  // droite (sans ce délai, elle filerait au coin avant de remonter vers la nouvelle place).
  const release = useRef(0);
  useEffect(() => {
    if (!anchor) return;
    window.clearTimeout(release.current);
    let raf = 0;
    let last: string | null = null;
    const follow = () => {
      // nouvelle place : on oublie un éventuel glisser sur la page d'avant
      if (last === null) {
        setDetached(false);
        setFree(CORNER);
      }
      const pos = anchorPosition(anchor);
      const key = pos ? `${pos.right}:${pos.bottom}` : "";
      if (key !== last) {
        last = key;
        setAnchored(pos);
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(raf);
      release.current = window.setTimeout(() => {
        setAnchored(null);
        setDetached(false);
        setFree(CORNER);
      }, RELEASE_MS);
    };
  }, [anchor]);

  // Place bavarde (TROIS) : une phrase au hasard dans une bulle quand un mot est trouvé ou perdu,
  // et de temps en temps. Les phrases viennent du stockage privé (/admin/mascotte).
  useEffect(() => {
    if (!anchor || !chatty) return;
    let phrases: string[] = [];
    let hide = 0;
    let next = 0;
    fetch("/api/mascotte/phrases")
      .then((res): Promise<{ phrases?: string[] }> | object => (res.ok ? res.json() : {}))
      .then((body: { phrases?: string[] }) => {
        phrases = body.phrases ?? [];
      })
      .catch(() => {});
    const say = () => {
      if (phrases.length === 0) return;
      setBubble(phrases[Math.floor(Math.random() * phrases.length)] ?? null);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setBubble(null), BUBBLE_MS);
    };
    const chatter = () => {
      next = window.setTimeout(
        () => {
          say();
          chatter();
        },
        CHATTER_MIN_MS + Math.random() * (CHATTER_MAX_MS - CHATTER_MIN_MS),
      );
    };
    chatter();
    const off = onMascotMoodChange((m) => {
      if (m === "victoire" || m === "erreur") say();
    });
    return () => {
      off();
      window.clearTimeout(hide);
      window.clearTimeout(next);
      setBubble(null);
    };
  }, [anchor, chatty]);

  useEffect(() => {
    if (!jumping) return;
    const timer = window.setTimeout(() => setJumping(false), JUMP_MS);
    return () => window.clearTimeout(timer);
  }, [jumping]);

  const onAnchor = anchored !== null && !detached;
  const pinned = onAnchor && !movable; // posée sur une place fixe : on ne la déplace pas
  const pos = onAnchor ? anchored : free;

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (pinned) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: pos, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDragging(true);
    setDetached(true);
    setFree(clamp({ right: d.from.right - dx, bottom: d.from.bottom - dy }, ref.current));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    // le clic qui suit un glisser ne doit pas la faire sauter
    if (d?.moved) dragged.current = true;
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        if (dragged.current) dragged.current = false;
        else setJumping(true);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Mascotte"
      title={pinned ? "Mascotte" : "Mascotte (glisser pour la déplacer)"}
      style={{ right: pos.right, bottom: pos.bottom }}
      // sans image (rien d'envoyé encore), le bouton disparaît ; elle glisse jusqu'à sa place
      // réservée et en revient, mais suit la souris sans délai
      className={cx(
        "fixed z-20 hidden touch-none select-none sm:not-empty:block",
        !dragging && "transition-[right,bottom] duration-700 ease-in-out",
        pinned ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
      )}
    >
      {bubble && (
        <span role="status" className="mascot-bubble">
          {bubble}
        </span>
      )}
      <Mascot
        mood={jumping ? "victoire" : onAnchor ? (mood ?? "repos") : "repos"}
        height={MASCOT_TOY_HEIGHT}
        className="block"
      />
    </button>
  );
}
