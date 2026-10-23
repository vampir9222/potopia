import { DIRECTIONS, FRAME_SIZE, type Animation, type Direction } from "@app/avatar-assets";
import type { SheetLayout } from "../src/compose";

/** Durée d'une frame par animation (ms). */
export const FRAME_MS: Record<Animation, number> = {
  idle: 450,
  walk: 90,
  sit: 900,
  jump: 110,
  emote: 260,
};

export const ANIMATION_LABELS: Record<Animation, string> = {
  idle: "Repos",
  walk: "Marche",
  sit: "Assis",
  jump: "Saut",
  emote: "Émotion",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  up: "Dos",
  left: "Gauche",
  down: "Face",
  right: "Droite",
};

/** Frame affichée à l'instant `ms` pour une animation en boucle. */
export function frameAt(layout: SheetLayout, animation: Animation, ms: number): number {
  return Math.floor(ms / FRAME_MS[animation]) % layout.frames[animation];
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Dessine une frame de la planche composée en (dx, dy), agrandie de `scale` (entier). */
export function drawFrame(
  ctx: Ctx,
  sheet: CanvasImageSource,
  layout: SheetLayout,
  animation: Animation,
  direction: Direction,
  frame: number,
  dx: number,
  dy: number,
  scale: number,
): void {
  const row = layout.rows[animation] + DIRECTIONS.indexOf(direction);
  const size = FRAME_SIZE * scale;
  ctx.drawImage(
    sheet,
    frame * FRAME_SIZE,
    row * FRAME_SIZE,
    FRAME_SIZE,
    FRAME_SIZE,
    dx,
    dy,
    size,
    size,
  );
}

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
