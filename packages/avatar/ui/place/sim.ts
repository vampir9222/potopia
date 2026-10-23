/**
 * Simulation de la place : 100 % locale (chaque navigateur a sa propre scène, rien n'est
 * synchronisé). Errance aléatoire en 4 directions : marcher vers un point (d'abord à l'horizontale,
 * puis à la verticale), faire une pause, repartir. Coordonnées en pixels CSS, `y` = les pieds.
 */
import type { Animation, Direction } from "@app/avatar-assets";

export type Rect = { x: number; y: number; w: number; h: number };

export type World = {
  width: number;
  height: number;
  /** Bande où marchent les personnages (haut de la scène réservé au décor). */
  walk: Rect;
  /** Zones à éviter (fontaine, arbres…). */
  obstacles: Rect[];
};

/** Action ponctuelle en cours (réaction à un clic ou à l'activité). */
export type Action = { animation: "jump" | "emote"; until: number };

export type Walker = {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  /** Assis (inactif depuis plus de 3 jours) : ne bouge plus. */
  asleep: boolean;
  target: { x: number; y: number } | null;
  /** Fin de la pause en cours (ms, horloge de la scène). */
  restUntil: number;
  action: Action | null;
  /** Bulle de texte affichée jusqu'à `until`. */
  bubble: { text: string; until: number } | null;
  /** Décalage de phase, pour que les personnages ne s'animent pas tous ensemble. */
  phase: number;
};

export type Rng = () => number;

/** Vitesse de marche (px/s). */
export const WALK_SPEED = 38;
/** Durées des actions ponctuelles (ms) : un saut complet, deux boucles d'émotion. */
export const ACTION_MS: Record<Action["animation"], number> = { jump: 550, emote: 1600 };

export const INACTIVE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

function inside(r: Rect, x: number, y: number, margin = 0): boolean {
  return x > r.x - margin && x < r.x + r.w + margin && y > r.y - margin && y < r.y + r.h + margin;
}

function blocked(world: World, x: number, y: number): boolean {
  return world.obstacles.some((o) => inside(o, x, y, 6));
}

/** Le trajet en L (horizontal puis vertical) évite-t-il les obstacles ? */
function clearPath(world: World, from: { x: number; y: number }, to: { x: number; y: number }) {
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (blocked(world, from.x + (to.x - from.x) * t, from.y)) return false;
    if (blocked(world, to.x, from.y + (to.y - from.y) * t)) return false;
  }
  return true;
}

/** Point libre au hasard dans la zone de marche. */
export function randomSpot(world: World, rng: Rng): { x: number; y: number } {
  const { walk } = world;
  for (let i = 0; i < 30; i++) {
    const p = { x: walk.x + rng() * walk.w, y: walk.y + rng() * walk.h };
    if (!blocked(world, p.x, p.y)) return p;
  }
  return { x: walk.x + walk.w / 2, y: walk.y + walk.h };
}

export function createWalker(id: string, world: World, rng: Rng, asleep: boolean): Walker {
  const spot = randomSpot(world, rng);
  const directions: Direction[] = ["down", "left", "right", "down"];
  return {
    id,
    ...spot,
    direction: directions[Math.floor(rng() * directions.length)] ?? "down",
    asleep,
    target: null,
    restUntil: rng() * 3000,
    action: null,
    bubble: null,
    phase: Math.floor(rng() * 1000),
  };
}

function pickTarget(world: World, w: Walker, rng: Rng) {
  for (let i = 0; i < 12; i++) {
    const spot = randomSpot(world, rng);
    // Promenades courtes : la place reste animée sans traversées incessantes.
    const near = { x: w.x + (spot.x - w.x) * 0.6, y: w.y + (spot.y - w.y) * 0.6 };
    if (clearPath(world, w, near)) return near;
  }
  return null;
}

/** Avance la simulation de `dt` ms (horloge `now`). `still` : pas de déplacement (moins d'animations). */
export function step(
  world: World,
  walkers: Walker[],
  now: number,
  dt: number,
  rng: Rng,
  still = false,
) {
  for (const w of walkers) {
    if (w.action && now >= w.action.until) w.action = null;
    if (w.bubble && now >= w.bubble.until) w.bubble = null;
    if (w.asleep || w.action || still) continue;

    if (!w.target) {
      if (now < w.restUntil) continue;
      w.target = pickTarget(world, w, rng);
      if (!w.target) {
        w.restUntil = now + 1000;
        continue;
      }
    }

    let budget = (WALK_SPEED * dt) / 1000;
    const target = w.target;
    // D'abord l'horizontale, puis la verticale : 4 directions seulement.
    const dx = target.x - w.x;
    if (Math.abs(dx) > 0.5) {
      const move = Math.min(Math.abs(dx), budget);
      w.x += Math.sign(dx) * move;
      budget -= move;
      w.direction = dx > 0 ? "right" : "left";
    }
    const dy = target.y - w.y;
    if (budget > 0 && Math.abs(dy) > 0.5) {
      const move = Math.min(Math.abs(dy), budget);
      w.y += Math.sign(dy) * move;
      w.direction = dy > 0 ? "down" : "up";
    }
    if (Math.abs(target.x - w.x) <= 0.5 && Math.abs(target.y - w.y) <= 0.5) {
      w.target = null;
      w.restUntil = now + 1500 + rng() * 5000;
      // À l'arrêt, souvent face à la caméra.
      if (rng() < 0.5) w.direction = "down";
    }
  }
}

/** Animation à afficher pour un personnage. */
export function animationOf(w: Walker): Animation {
  if (w.action) return w.action.animation;
  if (w.asleep) return "sit";
  return w.target ? "walk" : "idle";
}

/** Déclenche une action ponctuelle (un dormeur se réveille le temps de la réaction). */
export function act(w: Walker, animation: Action["animation"], now: number): void {
  w.action = { animation, until: now + ACTION_MS[animation] };
  w.target = null;
  if (!w.asleep) w.direction = "down";
}

export function say(w: Walker, text: string, now: number, ms = 2500): void {
  w.bubble = { text, until: now + ms };
}
