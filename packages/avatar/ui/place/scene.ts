/** Décor de la place, dessiné en code : herbe, chemin, fontaine, arbres, bancs, fleurs. */
import type { Rect, Rng, World } from "./sim";

/** Hauteur minimale de la scène ; elle grandit avec la place disponible. */
export const MIN_SCENE_HEIGHT = 280;
/** Bande du fond (arbres), au-dessus de la zone de marche. */
const BACK = 112;

/** Élément de décor trié avec les personnages selon `y` (le bas de l'objet). */
export type Prop = { kind: "tree" | "fountain" | "bench"; x: number; y: number };

/** `plaza` : centre de la fontaine, autour duquel se placent le chemin et les bancs. */
export type Scene = { world: World; props: Prop[]; plaza: { x: number; y: number } };

/** Générateur pseudo-aléatoire déterministe : le décor ne change pas d'un rafraîchissement à l'autre. */
export function seeded(seed: number): Rng {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function buildScene(width: number, rawHeight: number): Scene {
  const height = Math.max(MIN_SCENE_HEIGHT, Math.round(rawHeight));
  const walk: Rect = { x: 24, y: BACK, w: Math.max(0, width - 48), h: height - BACK - 12 };
  // Fontaine un peu au-dessus du milieu de la zone de marche (185 px pour 280 px de haut).
  const plaza = { x: Math.round(width / 2), y: Math.round(BACK + walk.h * 0.47) };
  const fountain: Rect = { x: plaza.x - 38, y: plaza.y - 17, w: 76, h: 34 };
  const props: Prop[] = [{ kind: "fountain", x: plaza.x, y: fountain.y + fountain.h }];
  const obstacles: Rect[] = [fountain];

  // Arbres au fond, espacés régulièrement, sans gêner la marche.
  const rng = seeded(7);
  for (let x = 40; x < width - 20; x += 150 + Math.floor(rng() * 60)) {
    props.push({ kind: "tree", x, y: 92 + Math.floor(rng() * 10) });
  }
  // Scène haute : quelques arbres en bas, sur les côtés (le tronc gêne la marche).
  if (height >= 400) {
    for (const x of [60, width - 70, Math.round(width * 0.28), Math.round(width * 0.74)]) {
      const y = height - 18 - Math.floor(rng() * 24);
      if (Math.abs(x - plaza.x) < 140) continue;
      props.push({ kind: "tree", x, y });
      obstacles.push({ x: x - 8, y: y - 10, w: 16, h: 12 });
    }
  }
  // Deux bancs de part et d'autre de la fontaine, si la place est assez large.
  if (width > 420) {
    for (const bx of [plaza.x - 150, plaza.x + 150]) {
      const by = plaza.y - 35;
      props.push({ kind: "bench", x: bx, y: by });
      obstacles.push({ x: bx - 22, y: by - 12, w: 44, h: 12 });
    }
  }
  return { world: { width, height, walk, obstacles }, props, plaza };
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
export function drawGround(ctx: Ctx, scene: Scene): void {
  const { width, height } = scene.world;
  const { x: cx, y: cy } = scene.plaza;
  ctx.fillStyle = GRASS;
  ctx.fillRect(0, 0, width, height);
  // Bande plus sombre au fond, pour la profondeur.
  ctx.fillStyle = GRASS_DARK;
  ctx.fillRect(0, 0, width, 70);

  // Chemin horizontal et dalle ronde autour de la fontaine.
  const pathTop = cy + 20;
  ctx.fillStyle = PATH_EDGE;
  ctx.fillRect(0, pathTop, width, 30);
  ctx.fillStyle = PATH;
  ctx.fillRect(0, pathTop + 2, width, 26);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 7, 100, 44, 0, 0, Math.PI * 2);
  ctx.fillStyle = PATH_EDGE;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 7, 96, 41, 0, 0, Math.PI * 2);
  ctx.fillStyle = PATH;
  ctx.fill();

  // Touffes d'herbe et fleurs, en pixels.
  const rng = seeded(width + height);
  for (let i = 0; i < (width * height) / 1700; i++) {
    const x = Math.floor(rng() * width);
    const y = 70 + Math.floor(rng() * (height - 70));
    if (y > pathTop - 5 && y < pathTop + 35) continue;
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
