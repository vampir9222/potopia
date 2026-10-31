"use client";

import { useEffect, useRef, useState } from "react";

// « Gomu Gomu no Gatling » : 4 frames de 350 × 200 (pixel art ×2), affichées à moitié.
const FRAMES = 4;
const W = 175;
const H = 100;
const FRAME_MS = 50;
const DURATION_MS = 1500;
// Le liseré du header occupe sa dernière ligne de pixels (header h-14 = 56 px) : les pieds dessus.
const LINE_Y = 55;
// La cloche est juste à droite (gap-2 + moitié du bouton) : les poings arrivent sur elle.
const BELL_CENTER = 26;
const STORAGE_KEY = "potopia:luffy-gatling-unread";

const readSeen = (): number | null => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
};
const writeSeen = (n: number) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* navigation privée : tant pis, il frappera peut-être une fois de trop */
  }
};

/**
 * Nouvelle notification : Luffy surgit à gauche de la cloche et la mitraille de coups de poing
 * (Gomu Gomu no Gatling), la cloche tremble. Une fois par nouvelle notification : le nombre de
 * non lues déjà vu est gardé sur l'appareil. Posé juste avant la cloche dans le header.
 */
export function LuffyGatling({ unreadCount }: { unreadCount: number }) {
  const [punching, setPunching] = useState(false);
  const spriteRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Le compteur a monté depuis la dernière fois : une rafale (rien à la toute première visite).
  // Chaque valeur n'est traitée qu'une fois, et le minuteur n'est pas annulé au démontage : en dev,
  // React rejoue l'effet, qui sinon effacerait la rafale déjà notée comme vue.
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (handled.current === unreadCount) return;
    const seen = handled.current ?? readSeen();
    handled.current = unreadCount;
    writeSeen(unreadCount);
    if (seen === null || unreadCount <= seen) return;
    window.setTimeout(() => setPunching(true), 600);
  }, [unreadCount]);

  useEffect(() => {
    if (!punching) return;
    const sprite = spriteRef.current;
    const bell = rootRef.current?.nextElementSibling;
    bell?.classList.add("bell-hit");
    const t0 = performance.now();
    const tick = window.setInterval(() => {
      const frame = Math.floor((performance.now() - t0) / FRAME_MS) % FRAMES;
      if (sprite) sprite.style.backgroundPosition = `${-frame * W}px 0`;
    }, FRAME_MS);
    const end = window.setTimeout(() => setPunching(false), DURATION_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(end);
      bell?.classList.remove("bell-hit");
    };
  }, [punching]);

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none relative -ml-2 w-0 self-stretch">
      {punching && (
        <span
          ref={spriteRef}
          className="luffy-gatling absolute z-40 block"
          style={{
            right: -BELL_CENTER,
            top: LINE_Y - H,
            width: W,
            height: H,
            backgroundImage: "url(/luffy/luffy-gatling.png)",
            backgroundSize: `${FRAMES * W}px ${H}px`,
          }}
        />
      )}
    </div>
  );
}
