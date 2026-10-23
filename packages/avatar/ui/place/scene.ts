/** Décor de la place, dessiné en code : herbe, chemin, fontaine, arbres, bancs, fleurs. */
import type { Rect, Rng, World } from "./sim";

export const SCENE_HEIGHT = 280;

/** Élément de décor trié avec les personnages selon `y` (le bas de l'objet). */
export type Prop = { kind: "tree" | "fountain" | "bench"; x: number; y: number };

export type Scene = { world: World; props: Prop[] };

/** Générateur pseudo-aléatoire déterministe : le décor ne change pas d'un rafraîchissement à l'autre. */
export function seeded(seed: number): Rng {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function buildScene(width: number): Scene {
  const height = SCENE_HEIGHT;
  const cx = Math.round(width / 2);
  const fountain: Rect = { x: cx - 38, y: 168, w: 76, h: 34 };
  const props: Prop[] = [{ kind: "fountain", x: cx, y: fountain.y + fountain.h }];
  const obstacles: Rect[] = [fountain];

  // Arbres au fond, espacés régulièrement, sans gêner la marche.
  const rng = seeded(7);
  for (let x = 40; x < width - 20; x += 150 + Math.floor(rng() * 60)) {
    props.push({ kind: "tree", x, y: 92 + Math.floor(rng() * 10) });
  }
  // Deux bancs de part et d'autre de la fontaine, si la place est assez large.
  if (width > 420) {
    for (const bx of [cx - 150, cx + 150]) {
      props.push({ kind: "bench", x: bx, y: 150 });
      obstacles.push({ x: bx - 22, y: 138, w: 44, h: 12 });
    }
  }
  return {
    world: {
      width,
      height,
      walk: { x: 24, y: 112, w: Math.max(0, width - 48), h: height - 124 },
      obstacles,
    },
    props,
  };
}

type Ctx = CanvasRenderingContext2D;

const GRASS = "#5f8f3e";
const GRASS_DARK = "#4d7a31";
const GRASS_LIGHT = "#74a64c";
const PATH = "#cdb68a";
const PATH_EDGE = "#a8916a";
const STONE = "#9aa3ad";
const STONE_DARK = "#6f7882";
const WATER = "#5fb3e0";

/** Sol (fond fixe, dessiné une fois par taille de scène). */
export function drawGround(ctx: Ctx, width: number): void {
  const height = SCENE_HEIGHT;
  ctx.fillStyle = GRASS;
  ctx.fillRect(0, 0, width, height);
  // Bande plus sombre au fond, pour la profondeur.
  ctx.fillStyle = GRASS_DARK;
  ctx.fillRect(0, 0, width, 70);

  const cx = Math.round(width / 2);
  // Chemin horizontal et dalle ronde autour de la fontaine.
  ctx.fillStyle = PATH_EDGE;
  ctx.fillRect(0, 205, width, 30);
  ctx.fillStyle = PATH;
  ctx.fillRect(0, 207, width, 26);
  ctx.beginPath();
  ctx.ellipse(cx, 192, 100, 44, 0, 0, Math.PI * 2);
  ctx.fillStyle = PATH_EDGE;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, 192, 96, 41, 0, 0, Math.PI * 2);
  ctx.fillStyle = PATH;
  ctx.fill();

  // Touffes d'herbe et fleurs, en pixels.
  const rng = seeded(width);
  for (let i = 0; i < width / 6; i++) {
    const x = Math.floor(rng() * width);
    const y = 70 + Math.floor(rng() * (height - 70));
    if (y > 200 && y < 240) continue;
    ctx.fillStyle = rng() < 0.5 ? GRASS_DARK : GRASS_LIGHT;
    ctx.fillRect(x, y, 2, 1);
    ctx.fillRect(x + 1, y - 1, 1, 1);
    if (rng() < 0.08) {
      ctx.fillStyle = ["#f4d35e", "#ee6c9a", "#ffffff", "#9b7bf0"][Math.floor(rng() * 4)] ?? "#fff";
      ctx.fillRect(x, y - 3, 2, 2);
    }
  }
}

export function drawProp(ctx: Ctx, prop: Prop, now: number, reduced: boolean): void {
  const { x, y } = prop;
  if (prop.kind === "tree") {
    ctx.fillStyle = "rgb(0 0 0 / 0.22)";
    ctx.beginPath();
    ctx.ellipse(x, y, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b4426";
    ctx.fillRect(x - 4, y - 26, 8, 26);
    for (const [dx, dy, r, color] of [
      [0, -48, 26, "#2f6b2c"],
      [-12, -40, 16, "#3c7d35"],
      [12, -42, 17, "#3c7d35"],
      [-4, -58, 14, "#4d9443"],
    ] as const) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (prop.kind === "bench") {
    ctx.fillStyle = "rgb(0 0 0 / 0.2)";
    ctx.fillRect(x - 22, y - 2, 44, 4);
    ctx.fillStyle = "#7a4f2c";
    ctx.fillRect(x - 22, y - 16, 44, 4);
    ctx.fillRect(x - 22, y - 9, 44, 4);
    ctx.fillStyle = "#4b3020";
    ctx.fillRect(x - 20, y - 6, 3, 6);
    ctx.fillRect(x + 17, y - 6, 3, 6);
    return;
  }
  // Fontaine : bassin de pierre, eau, jet qui scintille.
  ctx.fillStyle = STONE_DARK;
  ctx.beginPath();
  ctx.ellipse(x, y - 14, 40, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = STONE;
  ctx.beginPath();
  ctx.ellipse(x, y - 17, 38, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WATER;
  ctx.beginPath();
  ctx.ellipse(x, y - 18, 31, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x - 4, y - 40, 8, 22);
  const t = reduced ? 0 : Math.floor(now / 160) % 3;
  ctx.fillStyle = "#cfeeff";
  ctx.fillRect(x - 1, y - 52 - t, 2, 12);
  ctx.fillRect(x - 6 - t, y - 44, 2, 2);
  ctx.fillRect(x + 4 + t, y - 44, 2, 2);
}

/** Bulle de texte (pseudo au survol, réaction, « zzz »). */
export function drawBubble(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  tone: "light" | "dark" = "light",
) {
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  const w = Math.ceil(ctx.measureText(text).width) + 10;
  const h = 17;
  const left = Math.round(
    Math.min(Math.max(x - w / 2, 2), ctx.canvas.width / (ctx.getTransform().a || 1) - w - 2),
  );
  const top = Math.round(y - h);
  ctx.fillStyle = tone === "light" ? "rgb(255 255 255 / 0.95)" : "rgb(20 16 24 / 0.85)";
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 5);
  ctx.fill();
  ctx.fillStyle = tone === "light" ? "#1b1b1b" : "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + 5, top + h / 2 + 0.5);
}
