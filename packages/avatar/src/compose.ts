import {
  ANIMATIONS,
  CATEGORIES,
  DIRECTIONS,
  FRAME_SIZE,
  spriteFile,
  type Animation,
  type Catalog,
  type ColorId,
  type ColorSlot,
  type Palettes,
} from "@app/avatar-assets";
import type { AvatarConfig } from "./config";
import { excludedCategories, itemIndex } from "./rules";

/** Image RGBA non prémultipliée (même format que `ImageData`). */
export type RgbaImage = { width: number; height: number; data: Uint8ClampedArray };

/** Charge un PNG du catalogue (chemin relatif à `sprites/`). Fourni par le client ou le serveur. */
export type SpriteLoader = (file: string) => Promise<RgbaImage>;

/** Calque à dessiner : dossier des planches et remplacement de couleurs (`0xRRGGBB` → `0xRRGGBB`). */
export type ResolvedLayer = {
  itemId: string;
  zPos: number;
  dir: string;
  swap: Map<number, number>;
  /** Animations remplacées par une autre, ou non dessinées (`null`). */
  fallbacks?: Partial<Record<Animation, Animation | null>>;
};

/** Disposition de la planche composée : 4 lignes (directions) par animation, dans l'ordre. */
export type SheetLayout = {
  width: number;
  height: number;
  frames: Record<Animation, number>;
  /** Première ligne de chaque animation (la ligne d'une direction s'y ajoute). */
  rows: Record<Animation, number>;
};

export function sheetLayout(catalog: Pick<Catalog, "frames">): SheetLayout {
  const rows = {} as Record<Animation, number>;
  ANIMATIONS.forEach((anim, i) => (rows[anim] = i * DIRECTIONS.length));
  return {
    width: Math.max(...ANIMATIONS.map((a) => catalog.frames[a])) * FRAME_SIZE,
    height: ANIMATIONS.length * DIRECTIONS.length * FRAME_SIZE,
    frames: catalog.frames,
    rows,
  };
}

function hexToInt(hex: string): number {
  return Number.parseInt(hex.slice(1, 7), 16);
}

/** Teintes de `from` → teintes de même rang dans `to` (palette swap). */
function addSwap(swap: Map<number, number>, palettes: Palettes, slot: ColorSlot, to: ColorId) {
  if (to === slot.base) return;
  const source = palettes[slot.material][slot.base];
  const target = palettes[slot.material][to];
  if (!source || !target || source.length !== target.length) return;
  source.forEach((hex, i) => swap.set(hexToInt(hex), hexToInt(target[i] ?? hex)));
}

/**
 * Calques de la config, triés par zPos (à zPos égal, l'ordre des catégories puis des calques).
 * Applique les règles : un élément par catégorie, la robe retire le pantalon, chemins par tête.
 */
export function resolveLayers(
  config: AvatarConfig,
  catalog: Catalog,
  palettes: Palettes,
): ResolvedLayer[] {
  const index = itemIndex(catalog);
  const excluded = excludedCategories(config);
  const headId = config.items.head?.id;
  const layers: ResolvedLayer[] = [];

  for (const cat of CATEGORIES) {
    const choice = config.items[cat];
    const item = choice && !excluded.has(cat) ? index.get(choice.id) : undefined;
    if (!item || !item.morphs.includes(config.morph)) continue;
    const segment = item.headPaths ? item.headPaths[headId ?? ""] : "";
    if (segment === undefined) continue;

    const swap = new Map<number, number>();
    for (const slot of item.colors) {
      const color =
        slot.shared === "skin"
          ? config.skin
          : slot.shared === "eyes"
            ? config.eyes
            : (choice?.colors?.[slot.id] ?? slot.base);
      addSwap(swap, palettes, slot, color);
    }
    for (const layer of item.layers) {
      const dir = layer.dirs[config.morph];
      if (!dir) continue;
      layers.push({
        itemId: item.id,
        zPos: layer.zPos,
        dir: dir.replaceAll("${head}", segment),
        swap,
        ...(item.fallbacks ? { fallbacks: item.fallbacks } : {}),
      });
    }
  }
  // Tri stable : l'ordre d'insertion départage les zPos égaux.
  return layers.sort((a, b) => a.zPos - b.zPos);
}

/** Zone source d'un dessin (par défaut : toute l'image). */
type Region = { x: number; y: number; width: number; height: number };

/** Dessine `src` sur `dst` en (dx, dy), avec remplacement de couleurs et mélange alpha. */
export function blit(
  dst: RgbaImage,
  src: RgbaImage,
  dx: number,
  dy: number,
  swap?: ReadonlyMap<number, number>,
  region: Region = { x: 0, y: 0, width: src.width, height: src.height },
): void {
  const width = Math.min(region.width, src.width - region.x, dst.width - dx);
  const height = Math.min(region.height, src.height - region.y, dst.height - dy);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = ((y + region.y) * src.width + x + region.x) * 4;
      const sa = src.data[s + 3] ?? 0;
      if (sa === 0) continue;
      let r = src.data[s] ?? 0;
      let g = src.data[s + 1] ?? 0;
      let b = src.data[s + 2] ?? 0;
      if (swap && swap.size > 0) {
        const to = swap.get((r << 16) | (g << 8) | b);
        if (to !== undefined) {
          r = (to >> 16) & 0xff;
          g = (to >> 8) & 0xff;
          b = to & 0xff;
        }
      }
      const d = ((y + dy) * dst.width + x + dx) * 4;
      if (sa === 255) {
        dst.data[d] = r;
        dst.data[d + 1] = g;
        dst.data[d + 2] = b;
        dst.data[d + 3] = 255;
        continue;
      }
      // Mélange « source-over » en alpha non prémultiplié.
      const da = (dst.data[d + 3] ?? 0) / 255;
      const a = sa / 255;
      const outA = a + da * (1 - a);
      const mix = (sc: number, dc: number) => (sc * a + dc * da * (1 - a)) / outA;
      dst.data[d] = mix(r, dst.data[d] ?? 0);
      dst.data[d + 1] = mix(g, dst.data[d + 1] ?? 0);
      dst.data[d + 2] = mix(b, dst.data[d + 2] ?? 0);
      dst.data[d + 3] = outA * 255;
    }
  }
}

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/**
 * Compose la planche complète de l'avatar : les 5 animations l'une sous l'autre, 4 directions
 * chacune (voir `sheetLayout`). Même code côté navigateur (aperçu) et serveur (planche finale).
 */
export async function composeSheet(
  config: AvatarConfig,
  catalog: Catalog,
  palettes: Palettes,
  load: SpriteLoader,
): Promise<RgbaImage> {
  const layout = sheetLayout(catalog);
  const sheet = createImage(layout.width, layout.height);
  const layers = resolveLayers(config, catalog, palettes);
  // Planche à lire pour chaque animation : la sienne, celle qui la remplace, ou aucune.
  const sourceOf = (layer: ResolvedLayer, anim: Animation) => {
    const fallback = layer.fallbacks?.[anim];
    return fallback === undefined ? anim : fallback;
  };
  const images = await Promise.all(
    layers.flatMap((layer) =>
      ANIMATIONS.map((anim) => {
        const source = sourceOf(layer, anim);
        return source ? load(spriteFile(layer.dir, source)) : null;
      }),
    ),
  );
  layers.forEach((layer, i) => {
    ANIMATIONS.forEach((anim, j) => {
      const image = images[i * ANIMATIONS.length + j];
      if (!image) return;
      const top = layout.rows[anim] * FRAME_SIZE;
      if (sourceOf(layer, anim) === anim) {
        blit(sheet, image, 0, top, layer.swap);
        return;
      }
      // Frames d'une autre animation, reprises en boucle sur toute la durée de celle-ci.
      const sourceFrames = Math.max(1, Math.floor(image.width / FRAME_SIZE));
      for (let frame = 0; frame < layout.frames[anim]; frame++) {
        blit(sheet, image, frame * FRAME_SIZE, top, layer.swap, {
          x: (frame % sourceFrames) * FRAME_SIZE,
          y: 0,
          width: FRAME_SIZE,
          height: image.height,
        });
      }
    });
  });
  return sheet;
}
