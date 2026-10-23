import type { Category, Morph } from "@app/avatar-assets";

export const MORPH_LABELS: Record<Morph, string> = {
  male: "Homme",
  female: "Femme",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  body: "Corps",
  head: "Tête",
  eyes: "Visage",
  hair: "Cheveux",
  beards: "Barbe",
  facial: "Lunettes et masques",
  torso: "Haut",
  dress: "Robe",
  legs: "Bas",
  feet: "Chaussures",
  hat: "Chapeau",
  cape: "Cape",
  backpack: "Sac",
};

/** Têtes proposées (humaines, masculine et féminine). */
export const HEAD_LABELS: Record<string, string> = {
  heads_human_male: "Masculine",
  heads_human_female: "Féminine",
};
