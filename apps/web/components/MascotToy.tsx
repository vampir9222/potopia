"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";

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

/**
 * La mascotte en bas à droite de l'écran, par-dessus les pages (masquée sur petit écran, où elle
 * cacherait la page) : elle respire et cligne des yeux ; un clic la fait sauter de joie. On la
 * déplace en la faisant glisser, et sa place est retenue sur cet appareil.
 */
export function MascotToy() {
  const [jumping, setJumping] = useState(false);
  const [pos, setPos] = useState<Position>(DEFAULT);
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; from: Position; moved: boolean } | null>(null);
  const dragged = useRef(false);

  // Place retenue (navigateur seulement : le rendu serveur la pose au coin par défaut).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPos(clamp(JSON.parse(saved) as Position, ref.current));
    } catch {
      // stockage indisponible : coin par défaut
    }
  }, []);

  useEffect(() => {
    if (!jumping) return;
    const timer = window.setTimeout(() => setJumping(false), JUMP_MS);
    return () => window.clearTimeout(timer);
  }, [jumping]);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
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
    setPos(clamp({ right: d.from.right - dx, bottom: d.from.bottom - dy }, ref.current));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    // le clic qui suit le relâchement ne doit pas la faire sauter
    dragged.current = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // tant pis : elle reviendra au coin au prochain chargement
    }
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
      title="Mascotte (glisser pour la déplacer)"
      style={{ right: pos.right, bottom: pos.bottom }}
      // sans image (rien d'envoyé encore), le bouton disparaît
      className="fixed z-20 hidden cursor-grab touch-none select-none active:cursor-grabbing sm:not-empty:block"
    >
      <Mascot mood={jumping ? "victoire" : "repos"} height={180} className="block" />
    </button>
  );
}
