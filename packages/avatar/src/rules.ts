import {
  CATEGORIES,
  MORPHS,
  type Catalog,
  type CatalogItem,
  type Category,
  type ColorId,
  type ColorSlot,
  type Material,
  type Morph,
  type Palettes,
} from "@app/avatar-assets";
import type { AvatarConfig } from "./config";

/** Catégories obligatoires : sans corps ni tête, pas de personnage. */
export const REQUIRED_CATEGORIES: readonly Category[] = ["body", "head"];

/** Tête proposée d'abord pour une silhouette (après un changement de morphologie). */
export const PREFERRED_HEADS: Partial<Record<Morph, string>> = {
  male: "heads_human_male",
  female: "heads_human_female",
};

/** Une robe se porte sans pantalon : choisir `dress` retire `legs`. */
export const EXCLUSIONS: Partial<Record<Category, Category[]>> = { dress: ["legs"] };

/** Matériaux dont la couleur se choisit une fois pour tout l'avatar. */
const SHARED_MATERIAL: Record<NonNullable<ColorSlot["shared"]>, Material> = {
  skin: "body",
  eyes: "eye",
};

export function itemIndex(catalog: Catalog): Map<string, CatalogItem> {
  const cache = indexCache.get(catalog);
  if (cache) return cache;
  const index = new Map(catalog.items.map((item) => [item.id, item]));
  indexCache.set(catalog, index);
  return index;
}
const indexCache = new WeakMap<Catalog, Map<string, CatalogItem>>();

/** Morphologies jouables : au moins un corps et une tête dans le catalogue. */
export function availableMorphs(catalog: Catalog): Morph[] {
  return MORPHS.filter((morph) =>
    REQUIRED_CATEGORIES.every((cat) =>
      catalog.items.some((i) => i.category === cat && i.morphs.includes(morph)),
    ),
  );
}

/** Catégories retirées par les éléments choisis (`legs` quand une robe est portée). */
export function excludedCategories(config: Pick<AvatarConfig, "items">): Set<Category> {
  const out = new Set<Category>();
  for (const cat of CATEGORIES) {
    if (config.items[cat]) for (const excluded of EXCLUSIONS[cat] ?? []) out.add(excluded);
  }
  return out;
}

/** Tags portés par le corps et la tête choisis (les visages exigent une tête `human`…). */
function chosenTags(config: AvatarConfig, catalog: Catalog): Set<string> {
  const index = itemIndex(catalog);
  const tags = new Set<string>();
  for (const cat of REQUIRED_CATEGORIES) {
    const item = index.get(config.items[cat]?.id ?? "");
    for (const tag of item?.tags ?? []) tags.add(tag);
  }
  return tags;
}

/** L'élément existe-t-il pour cette morphologie (et cette tête, s'il en dépend) ? */
export function isCompatible(item: CatalogItem, config: AvatarConfig, catalog: Catalog): boolean {
  if (!item.morphs.includes(config.morph)) return false;
  if (item.heads) {
    const headId = config.items.head?.id;
    if (!headId || !item.heads[config.morph]?.includes(headId)) return false;
  }
  if (item.requiredTags.length > 0) {
    const tags = chosenTags(config, catalog);
    if (!item.requiredTags.every((t) => tags.has(t))) return false;
  }
  return true;
}

/** Éléments proposés dans une catégorie pour la config en cours. */
export function optionsFor(
  catalog: Catalog,
  config: AvatarConfig,
  category: Category,
): CatalogItem[] {
  return catalog.items.filter(
    (item) => item.category === category && isCompatible(item, config, catalog),
  );
}

/** Couleurs possibles pour un matériau : celles dont le dégradé a la longueur de la base. */
export function colorChoices(palettes: Palettes, material: Material, base?: ColorId): ColorId[] {
  const colors = palettes[material];
  const length = base ? colors[base]?.length : Object.values(colors)[0]?.length;
  return Object.keys(colors).filter((id) => colors[id]?.length === length);
}

export function skinChoices(palettes: Palettes): ColorId[] {
  return colorChoices(palettes, SHARED_MATERIAL.skin);
}

export function eyeChoices(palettes: Palettes): ColorId[] {
  return colorChoices(palettes, SHARED_MATERIAL.eyes);
}

/** Emplacements de couleur réglables élément par élément (hors peau et yeux, partagés). */
export function ownColorSlots(item: CatalogItem): ColorSlot[] {
  return item.colors.filter((slot) => !slot.shared);
}

/**
 * Problèmes d'une config par rapport au catalogue, en français (vide si elle est valide).
 * `owned` : éléments débloqués par le membre (pour les éléments qui ne sont pas « free »).
 */
export function checkConfig(
  config: AvatarConfig,
  catalog: Catalog,
  palettes: Palettes,
  owned: ReadonlySet<string> = new Set(),
): string[] {
  const issues: string[] = [];
  const index = itemIndex(catalog);
  if (!availableMorphs(catalog).includes(config.morph)) {
    issues.push(`Morphologie indisponible : ${config.morph}.`);
  }
  if (!skinChoices(palettes).includes(config.skin)) issues.push("Couleur de peau invalide.");
  if (!eyeChoices(palettes).includes(config.eyes)) issues.push("Couleur des yeux invalide.");
  for (const cat of REQUIRED_CATEGORIES) {
    if (!config.items[cat]) issues.push(`Élément obligatoire manquant : ${cat}.`);
  }
  const excluded = excludedCategories(config);

  for (const cat of CATEGORIES) {
    const choice = config.items[cat];
    if (!choice) continue;
    const item = index.get(choice.id);
    if (!item || item.category !== cat) {
      issues.push(`Élément inconnu : ${choice.id}.`);
      continue;
    }
    if (excluded.has(cat)) issues.push(`« ${item.name} » ne se porte pas avec cette tenue.`);
    if (!isCompatible(item, config, catalog)) {
      issues.push(`« ${item.name} » n'existe pas pour cette morphologie.`);
    }
    if (item.unlock !== "free" && !owned.has(item.id)) {
      issues.push(`« ${item.name} » n'est pas débloqué.`);
    }
    for (const [slotId, color] of Object.entries(choice.colors ?? {})) {
      const slot = ownColorSlots(item).find((s) => s.id === slotId);
      if (!slot || !colorChoices(palettes, slot.material, slot.base).includes(color)) {
        issues.push(`Couleur invalide pour « ${item.name} ».`);
      }
    }
  }
  return issues;
}

/** Copie des éléments choisis sans la catégorie donnée. */
export function withoutCategory(
  items: AvatarConfig["items"],
  category: Category,
): AvatarConfig["items"] {
  return Object.fromEntries(Object.entries(items).filter(([cat]) => cat !== category));
}

/**
 * Retire de la config ce qui n'est plus compatible (après un changement de morphologie ou de
 * tête) et ce qu'exclut un autre élément. Le corps et la tête sont remplacés au besoin.
 */
export function fitConfig(config: AvatarConfig, catalog: Catalog): AvatarConfig {
  const next: AvatarConfig = { ...config, items: { ...config.items } };
  const index = itemIndex(catalog);
  for (const cat of REQUIRED_CATEGORIES) {
    const current = index.get(next.items[cat]?.id ?? "");
    if (!current || !isCompatible(current, next, catalog)) {
      const options = optionsFor(catalog, next, cat);
      const preferred = cat === "head" ? PREFERRED_HEADS[next.morph] : undefined;
      const first = options.find((o) => o.id === preferred) ?? options[0];
      if (first) next.items[cat] = { id: first.id };
      else next.items = withoutCategory(next.items, cat);
    }
  }
  const excluded = excludedCategories(next);
  for (const cat of CATEGORIES) {
    const item = index.get(next.items[cat]?.id ?? "");
    if (excluded.has(cat) || (next.items[cat] && (!item || !isCompatible(item, next, catalog)))) {
      next.items = withoutCategory(next.items, cat);
    }
  }
  return next;
}
