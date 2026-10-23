import type { Catalog, CatalogItem, Palettes } from "@app/avatar-assets";
import type { AvatarConfig } from "../src/config";
import type { RgbaImage, SpriteLoader } from "../src/compose";

const FRAMES = { idle: 1, walk: 2, sit: 1, jump: 1, emote: 1 };

function item(partial: Partial<CatalogItem> & Pick<CatalogItem, "id" | "category">): CatalogItem {
  return {
    name: partial.id,
    morphs: ["male", "female"],
    layers: [{ zPos: 10, dirs: { male: `${partial.id}/`, female: `${partial.id}/` } }],
    frames: FRAMES,
    colors: [],
    tags: [],
    requiredTags: [],
    unlock: "free",
    ...partial,
  };
}

const skin = { id: "main", material: "body", base: "ulpc.light", shared: "skin" } as const;

/** Catalogue minimal : corps, tête, vêtements, cape bg/fg, robe, élément à débloquer. */
export const catalog: Catalog = {
  source: { repo: "test", ref: "abc" },
  frames: FRAMES,
  items: [
    item({ id: "body", category: "body", colors: [skin] }),
    item({
      id: "head_human",
      category: "head",
      tags: ["human"],
      layers: [{ zPos: 100, dirs: { male: "head/", female: "head/" } }],
      colors: [skin, { id: "color_2", material: "eye", base: "ulpc.blue", shared: "eyes" }],
    }),
    item({
      id: "head_wolf",
      category: "head",
      layers: [{ zPos: 100, dirs: { male: "wolf/" } }],
      morphs: ["male"],
    }),
    item({
      id: "shirt",
      category: "torso",
      layers: [{ zPos: 35, dirs: { male: "shirt/", female: "shirt/" } }],
      colors: [{ id: "main", material: "cloth", base: "ulpc.white" }],
    }),
    item({
      id: "pants",
      category: "legs",
      layers: [{ zPos: 20, dirs: { male: "pants/", female: "pants/" } }],
    }),
    item({
      id: "dress",
      category: "dress",
      layers: [{ zPos: 30, dirs: { female: "dress/", male: "dress/" } }],
    }),
    item({
      id: "cape",
      category: "cape",
      layers: [
        { zPos: 110, dirs: { male: "cape/fg/", female: "cape/fg/" } },
        { zPos: 5, dirs: { male: "cape/bg/", female: "cape/bg/" } },
      ],
    }),
    item({
      id: "skirt_female_only",
      category: "legs",
      morphs: ["female"],
      layers: [{ zPos: 20, dirs: { female: "skirt/" } }],
    }),
    item({
      id: "face_happy",
      category: "eyes",
      requiredTags: ["human"],
      layers: [
        { zPos: 101, dirs: { male: "faces/${head}/happy/", female: "faces/${head}/happy/" } },
      ],
      headPaths: { head_human: "human" },
      heads: { male: ["head_human"], female: ["head_human"] },
    }),
    item({ id: "crown", category: "hat", unlock: { item: "crown" } }),
  ],
};

export const palettes: Palettes = {
  body: { "ulpc.light": ["#ffeedd", "#eeddcc"], "ulpc.brown": ["#553322", "#442211"] },
  hair: { "ulpc.orange": ["#ff8800"] },
  cloth: { "ulpc.white": ["#ffffff"], "ulpc.red": ["#ff0000"] },
  eye: { "ulpc.blue": ["#0000ff"], "ulpc.green": ["#00ff00"] },
  metal: {},
  wood: {},
};

export function baseConfig(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    v: 1,
    morph: "male",
    skin: "ulpc.light",
    eyes: "ulpc.blue",
    items: { body: { id: "body" }, head: { id: "head_human" } },
    ...overrides,
  };
}

/** Image d'un pixel opaque en (0, 0), de la couleur donnée. */
export function pixel(hex: string, alpha = 255): RgbaImage {
  const n = Number.parseInt(hex.slice(1), 16);
  return {
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([n >> 16, (n >> 8) & 0xff, n & 0xff, alpha]),
  };
}

/** Chargeur qui renvoie, pour chaque dossier, l'image donnée (et note les fichiers demandés). */
export function fakeLoader(images: Record<string, RgbaImage>): SpriteLoader & { calls: string[] } {
  const calls: string[] = [];
  const load = async (file: string) => {
    calls.push(file);
    const dir = file.slice(0, file.lastIndexOf("/") + 1);
    return images[dir] ?? { width: 0, height: 0, data: new Uint8ClampedArray() };
  };
  return Object.assign(load, { calls });
}
