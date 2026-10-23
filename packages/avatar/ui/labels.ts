import type { Category, Morph } from "@app/avatar-assets";

export const MORPH_LABELS: Record<Morph, string> = {
  male: "Homme",
  female: "Femme",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  body: "Corps",
  head: "Tête",
  eyes: "Visage",
  eyebrows: "Sourcils",
  nose: "Nez",
  ears: "Oreilles",
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

/** Têtes proposées (humaines). */
export const HEAD_LABELS: Record<string, string> = {
  heads_human_male: "Masculine",
  heads_human_female: "Féminine",
  heads_human_male_small: "Masculine fine",
  heads_human_female_small: "Féminine fine",
  heads_human_male_plump: "Masculine ronde",
  heads_human_male_gaunt: "Masculine creusée",
  heads_human_male_elderly: "Masculine âgée",
  heads_human_female_elderly: "Féminine âgée",
  heads_human_elderly_small: "Âgée fine",
};
