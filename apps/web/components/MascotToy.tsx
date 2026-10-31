"use client";

import { cx } from "@app/ui";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";
import { MASCOT_TOY_HEIGHT } from "./MascotAnchor";
import { useMascotStage } from "./mascotStage";

const JUMP_MS = 1000;
const MARGIN = 24;
// au-delà de ce déplacement (px), c'est un glisser et pas un clic
const DRAG_THRESHOLD = 4;
const STORAGE_KEY = "mascot-position";

/** Distance au bord droit et au bas de la fenêtre. */
type Position = { right: number; bottom: number };
const DEFAULT: Position = { right: MARGIN, bottom: MARGIN };

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
 * La mascotte en bas à droite de l'écran, par-dessus les pages (masquée sur petit écran, où elle
 * cacherait la page) : elle respire et cligne des yeux ; un clic la fait sauter de joie. On la
 * déplace en la faisant glisser, et sa place est retenue sur cet appareil. Quand une page lui
 * réserve une place (MascotAnchor, sous le podium de TROIS), elle y glisse et prend l'humeur
 * demandée, puis revient au coin en bas à droite quand on quitte la page.
 */
export function MascotToy() {
  const [jumping, setJumping] = useState(false);
  const [home, setHome] = useState<Position>(DEFAULT);
  const [anchored, setAnchored] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const { anchor, mood } = useMascotStage();
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; from: Position; moved: boolean } | null>(null);
  const dragged = useRef(false);

  // Place retenue (navigateur seulement : le rendu serveur la pose au coin par défaut).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHome(clamp(JSON.parse(saved) as Position, ref.current));
    } catch {
      // stockage indisponible : coin par défaut
    }
  }, []);

  // Place réservée : on la suit à chaque image (défilement, redimensionnement, colonne sticky). En
  // la quittant (retour à l'accueil…), elle revient au coin en bas à droite.
  useEffect(() => {
    if (!anchor) return;
    let raf = 0;
    let last = "";
    const follow = () => {
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
      setAnchored(null);
      setHome(DEFAULT);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // rien à oublier
      }
    };
  }, [anchor]);

  useEffect(() => {
    if (!jumping) return;
    const timer = window.setTimeout(() => setJumping(false), JUMP_MS);
    return () => window.clearTimeout(timer);
  }, [jumping]);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (anchored) return; // posée sur sa place réservée : on ne la déplace pas
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: home, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDragging(true);
    setHome(clamp({ right: d.from.right - dx, bottom: d.from.bottom - dy }, ref.current));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d?.moved) return;
    // le clic qui suit le relâchement ne doit pas la faire sauter
    dragged.current = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(home));
    } catch {
      // tant pis : elle reviendra au coin au prochain chargement
    }
  }

  const pos = anchored ?? home;
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
      title={anchored ? "Mascotte" : "Mascotte (glisser pour la déplacer)"}
      style={{ right: pos.right, bottom: pos.bottom }}
      // sans image (rien d'envoyé encore), le bouton disparaît ; elle glisse jusqu'à sa place
      // réservée et en revient, mais suit la souris sans délai
      className={cx(
        "fixed z-20 hidden touch-none select-none sm:not-empty:block",
        !dragging && "transition-[right,bottom] duration-700 ease-in-out",
        anchored ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <Mascot
        mood={jumping ? "victoire" : anchored ? (mood ?? "repos") : "repos"}
        height={MASCOT_TOY_HEIGHT}
        className="block"
      />
    </button>
  );
}
