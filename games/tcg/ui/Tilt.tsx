"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useRef } from "react";

/**
 * Carte qui s'incline vers le pointeur, avec reflet et holo qui suivent (classes de tcg.css).
 * Les effets lisent --mx/--my (%), --x (0 à 1) et --rx/--ry, posées ici sans re-rendu React.
 */
export function Tilt({
  children,
  radius,
  style,
}: {
  children: ReactNode;
  radius: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--x", x.toFixed(3));
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 18}deg`);
    el.dataset.active = "";
  }

  function leave() {
    const el = ref.current;
    if (!el) return;
    for (const v of ["--mx", "--my", "--x", "--rx", "--ry"]) el.style.removeProperty(v);
    delete el.dataset.active;
  }

  return (
    <div
      ref={ref}
      className="tcg-tilt"
      onPointerMove={move}
      onPointerLeave={leave}
      style={{ borderRadius: radius, ...style }}
    >
      {children}
    </div>
  );
}
