import type { EffectParams } from "./effects";

/*
 * Règles et types des cartes sans dépendance serveur : importables par l'éditeur côté navigateur.
 */

export const CARD_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "sr",
  "ssr",
] as const;
export type CardRarityId = (typeof CARD_RARITIES)[number];

export const CARD_RARITY_LABELS: Record<CardRarityId, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  sr: "Secrète (SR)",
  ssr: "Super secrète (SSR)",
};

export const CARD_LIMITS = {
  name: 60,
  type: 40,
  family: 40,
  effectText: 300,
  flavor: 300,
  cost: { min: 0, max: 6 },
  power: { min: -20, max: 30 },
  imageBytes: 5 * 1024 * 1024,
} as const;

export const CARD_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type CardImageType = keyof typeof CARD_IMAGE_TYPES;

export type CardSet = { id: string; code: string; name: string };

export type Card = {
  id: string;
  setId: string;
  setCode: string;
  number: number;
  name: string;
  rarity: CardRarityId;
  type: string;
  family: string | null;
  cost: number;
  power: number;
  effectKey: string | null;
  effectParams: EffectParams | null;
  effectText: string;
  flavor: string | null;
  imageKey: string | null;
  ideaId: string | null;
  baseCardId: string | null;
  updatedAt: Date;
};
