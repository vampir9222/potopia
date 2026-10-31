"use client";

import { useEffect, useState } from "react";
import { isTimeStopped } from "./timeStop";

const STRIKE_MS = 900;
const WAIT_MIN_MS = 35_000;
const WAIT_MAX_MS = 80_000;

type Point = [number, number];

/**
 * Éclair entre deux points, par déplacement des milieux : chaque segment est coupé en deux et son
 * milieu écarté au hasard, de moins en moins à chaque niveau.
 */
function bolt(a: Point, b: Point, spread: number, depth: number): Point[] {
  if (depth === 0) return [a, b];
  const [ax, ay] = a;
  const [bx, by] = b;
  const len = Math.hypot(bx - ax, by - ay);
  const off = (Math.random() - 0.5) * spread * len;
  // milieu écarté perpendiculairement au segment
  const mid: Point = [
    (ax + bx) / 2 + (-(by - ay) / len) * off,
    (ay + by) / 2 + ((bx - ax) / len) * off,
  ];
  return [...bolt(a, mid, spread, depth - 1).slice(0, -1), ...bolt(mid, b, spread, depth - 1)];
}

const path = (pts: Point[]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");

/** Quelques éclairs qui partent des bords vers l'intérieur de l'écran, avec leurs ramifications. */
function strike(w: number, h: number): string[] {
  const paths: string[] = [];
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const side = Math.floor(Math.random() * 4);
    const t = Math.random();
    const start: Point =
      side === 0 ? [t * w, 0] : side === 1 ? [w, t * h] : side === 2 ? [t * w, h] : [0, t * h];
    // vers l'intérieur, sans aller jusqu'au centre
    const end: Point = [
      start[0] +
        (w / 2 - start[0]) * (0.35 + Math.random() * 0.35) +
        (Math.random() - 0.5) * w * 0.2,
      start[1] +
        (h / 2 - start[1]) * (0.35 + Math.random() * 0.35) +
        (Math.random() - 0.5) * h * 0.2,
    ];
    const main = bolt(start, end, 0.45, 6);
    paths.push(path(main));
    // ramifications, plus courtes, qui partent du tronc
    for (let k = 0; k < 3; k++) {
      const from = main[Math.floor(main.length * (0.25 + Math.random() * 0.5))] ?? start;
      const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) + (Math.random() - 0.5) * 1.6;
      const reach = Math.hypot(end[0] - start[0], end[1] - start[1]) * (0.2 + Math.random() * 0.25);
      paths.push(
        path(
          bolt(
            from,
            [from[0] + Math.cos(angle) * reach, from[1] + Math.sin(angle) * reach],
            0.5,
            4,
          ),
        ),
      );
    }
  }
  return paths;
}

/**
 * Haki des rois (thème One Piece) : de temps en temps, des éclairs noirs cerclés de rouge crépitent
 * depuis les bords de l'écran, dans un voile sombre, puis s'éteignent. Seulement avec ce thème,
 * onglet visible, temps qui s'écoule ; jamais si l'appareil demande moins d'animations.
 */
export function OnePieceHaki() {
  const [bolts, setBolts] = useState<{ id: number; w: number; h: number; paths: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(
        () => {
          if (
            document.documentElement.dataset.theme === "onepiece" &&
            !document.hidden &&
            !isTimeStopped()
          ) {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setBolts({ id: Date.now(), w, h, paths: strike(w, h) });
            timer = window.setTimeout(() => {
              setBolts(null);
              next();
            }, STRIKE_MS);
            return;
          }
          next();
        },
        WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS),
      );
    };
    next();
    return () => window.clearTimeout(timer);
  }, []);

  if (!bolts) return null;
  return (
    <div aria-hidden key={bolts.id} className="op-haki">
      <span className="op-haki-flash" />
      <svg viewBox={`0 0 ${bolts.w} ${bolts.h}`}>
        {bolts.paths.map((d, i) => (
          <path key={`g${i}`} d={d} className="op-haki-glow" />
        ))}
        {bolts.paths.map((d, i) => (
          <path key={`c${i}`} d={d} className="op-haki-core" />
        ))}
      </svg>
    </div>
  );
}
