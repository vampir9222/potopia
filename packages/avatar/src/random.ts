import type { Catalog, CatalogItem, Category, ColorId, Morph, Palettes } from "@app/avatar-assets";
import type { AvatarConfig, AvatarItemChoice } from "./config";
import {
  availableMorphs,
  colorChoices,
  eyeChoices,
  fitConfig,
  optionsFor,
  ownColorSlots,
} from "./rules";

/** Générateur aléatoire (`Math.random` par défaut), remplaçable pour des tirages reproductibles. */
export type Rng = () => number;

/** Teintes de peau et de cheveux réalistes, pour un avatar aléatoire « crédible ». */
const NATURAL_SKINS = [
  "ulpc.light",
  "ulpc.amber",
  "ulpc.olive",
  "ulpc.taupe",
  "ulpc.bronze",
  "ulpc.brown",
  "ulpc.black",
  "lpcr.ivory",
  "lpcr.peach",
  "lpcr.tan",
  "lpcr.honey",
  "lpcr.coffee",
];
const NATURAL_HAIR = [
  "ulpc.blonde",
  "ulpc.sandy",
  "ulpc.ginger",
  "ulpc.redhead",
  "ulpc.light_brown",
  "ulpc.chestnut",
  "ulpc.dark_brown",
  "ulpc.black",
  "ulpc.raven",
  "ulpc.gray",
  "ulpc.platinum",
];
/** Tête par silhouette (seules les têtes humaines masculine et féminine sont importées). */
const HEADS: Partial<Record<Morph, string[]>> = {
  male: ["heads_human_male"],
  female: ["heads_human_female"],
};
const MORPH_WEIGHTS: Partial<Record<Morph, number>> = { male: 1, female: 1 };

function pick<T>(rng: Rng, list: readonly T[]): T | undefined {
  return list[Math.floor(rng() * list.length)];
}

function pickWeighted<T extends string>(rng: Rng, weights: [T, number][]): T | undefined {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, w] of weights) {
    roll -= w;
    if (roll < 0) return value;
  }
  return weights.at(-1)?.[0];
}

function randomColors(
  rng: Rng,
  item: CatalogItem,
  palettes: Palettes,
  hair: ColorId,
): AvatarItemChoice["colors"] {
  const colors: Record<string, ColorId> = {};
  for (const slot of ownColorSlots(item)) {
    const choices = colorChoices(palettes, slot.material, slot.base);
    const color = slot.material === "hair" && choices.includes(hair) ? hair : pick(rng, choices);
    if (color) colors[slot.id] = color;
  }
  return colors;
}

/**
 * Avatar aléatoire mais cohérent : tête humaine assortie à la silhouette, couleurs naturelles de
 * peau et de cheveux, haut et bas (ou robe), chaussures, parfois barbe ou chapeau.
 */
export function randomConfig(
  catalog: Catalog,
  palettes: Palettes,
  rng: Rng = Math.random,
): AvatarConfig {
  // Un premier avatar ne possède encore aucun élément à débloquer.
  const freeCatalog: Catalog = {
    ...catalog,
    items: catalog.items.filter((item) => item.unlock === "free"),
  };
  const morphs = availableMorphs(freeCatalog);
  const morph =
    pickWeighted(
      rng,
      morphs.map((m) => [m, MORPH_WEIGHTS[m] ?? 0.5] as [Morph, number]),
    ) ??
    morphs[0] ??
    "male";
  const skins = NATURAL_SKINS.filter((c) => palettes.body[c]);
  const hairColor =
    pick(
      rng,
      NATURAL_HAIR.filter((c) => palettes.hair[c]),
    ) ?? "ulpc.black";
  let config: AvatarConfig = {
    v: 1,
    morph,
    skin: pick(rng, skins) ?? "ulpc.light",
    eyes: pick(rng, eyeChoices(palettes)) ?? "ulpc.blue",
    items: {},
  };

  const choose = (category: Category, filter: (item: CatalogItem) => boolean = () => true) => {
    const item = pick(rng, optionsFor(freeCatalog, config, category).filter(filter));
    if (item) {
      config.items[category] = {
        id: item.id,
        colors: randomColors(rng, item, palettes, hairColor),
      };
    }
  };

  choose("body");
  const heads = HEADS[morph] ?? [];
  choose("head", (item) => heads.includes(item.id));
  if (!config.items.head) choose("head");

  const chance = (p: number) => rng() < p;
  if (chance(0.92)) choose("hair");
  if (chance(0.6)) choose("eyebrows");
  if (chance(0.35)) choose("nose");
  if (chance(0.3) && morph === "male") choose("beards");
  if (chance(0.15) && optionsFor(freeCatalog, config, "dress").length > 0) {
    choose("dress");
  } else {
    choose("torso");
    choose("legs");
  }
  if (chance(0.85)) choose("feet");
  if (chance(0.15)) choose("hat");
  if (chance(0.12)) choose("cape");
  config = fitConfig(config, freeCatalog);
  return config;
}
