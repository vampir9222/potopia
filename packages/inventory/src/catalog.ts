// Catalogue des objets de l'inventaire, partagé client/serveur (aucune donnée secrète ici).

export const EMERALD_COLORS = [
  "green",
  "red",
  "blue",
  "yellow",
  "cyan",
  "white",
  "purple",
] as const;
export type EmeraldColor = (typeof EMERALD_COLORS)[number];

export type Emerald = {
  id: `emerald-${EmeraldColor}`;
  color: EmeraldColor;
  name: string;
};

/**
 * Les 7 Émeraudes du Chaos, chacune cachée sur une page du site (`HiddenEmerald` dans la page).
 * Les trouver toutes débloque Super Sonic dans le header.
 */
export const EMERALDS: readonly Emerald[] = [
  { id: "emerald-green", color: "green", name: "Émeraude verte" },
  {
    id: "emerald-red",
    color: "red",
    name: "Émeraude rouge",
  },
  { id: "emerald-blue", color: "blue", name: "Émeraude bleue" },
  {
    id: "emerald-yellow",
    color: "yellow",
    name: "Émeraude jaune",
  },
  { id: "emerald-cyan", color: "cyan", name: "Émeraude cyan" },
  {
    id: "emerald-white",
    color: "white",
    name: "Émeraude blanche",
  },
  { id: "emerald-purple", color: "purple", name: "Émeraude violette" },
];

export const ITEM_IDS: readonly string[] = EMERALDS.map((e) => e.id);

/** Image de l'émeraude (servie par l'app, `public/emeralds`). */
export const emeraldSrc = (color: EmeraldColor): string => `/emeralds/emerald-${color}.png`;

export const emeraldId = (color: EmeraldColor): Emerald["id"] => `emerald-${color}`;

/** Nombre d'émeraudes parmi les objets trouvés. */
export const countEmeralds = (items: readonly string[]): number =>
  EMERALDS.filter((e) => items.includes(e.id)).length;

/** Les 7 émeraudes trouvées : Super Sonic débloqué. */
export const hasAllEmeralds = (items: readonly string[]): boolean =>
  countEmeralds(items) === EMERALDS.length;
