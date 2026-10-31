"use client";

import type { Animation, Direction } from "@app/avatar-assets";
import { timeNow } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import type { SheetLayout } from "../src/compose";
import { drawFrame, frameAt, prefersReducedMotion } from "./animation";
import { loadSheet } from "./browser";

type Props = {
  /** URL de la planche composée, ou bitmap déjà chargé (aperçu de l'éditeur). */
  sheet: string | ImageBitmap | null;
  layout: SheetLayout;
  animation?: Animation;
  direction?: Direction;
  /** Agrandissement entier (pixel art net). */
  scale?: number;
  /** Texte alternatif ; sans lui, l'image est décorative. */
  label?: string;
  className?: string;
};

/**
 * Personnage animé sur un canvas. Une seule frame fixe si l'appareil demande moins d'animations ;
 * la boucle s'arrête d'elle-même quand l'onglet est caché (requestAnimationFrame).
 */
export function AvatarSprite({
  sheet,
  layout,
  animation = "idle",
  direction = "down",
  scale = 2,
  label,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{ url: string; bitmap: ImageBitmap } | null>(null);
  const bitmap = typeof sheet === "string" ? (loaded?.url === sheet ? loaded.bitmap : null) : sheet;

  useEffect(() => {
    if (typeof sheet !== "string") return;
    let cancelled = false;
    loadSheet(sheet)
      .then((b) => !cancelled && setLoaded({ url: sheet, bitmap: b }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sheet]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const draw = (frame: number) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (bitmap) drawFrame(ctx, bitmap, layout, animation, direction, frame, 0, 0, scale);
    };
    if (prefersReducedMotion() || !bitmap) {
      draw(0);
      return;
    }
    let raf = 0;
    // horloge commune : figée par « ZA WARUDO » (thème JoJo)
    const start = timeNow();
    const loop = () => {
      draw(frameAt(layout, animation, timeNow() - start));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bitmap, layout, animation, direction, scale]);

  const size = 64 * scale;
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated", width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
