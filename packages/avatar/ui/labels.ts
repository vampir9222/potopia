import type { Category, Morph } from "@app/avatar-assets";

export const MORPH_LABELS: Record<Morph, string> = {
  male: "Homme",
  female: "Femme",
  teen: "Ado",
  child: "Enfant",
  muscular: "Musclé",
  pregnant: "Enceinte",
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
  neck: "Cou",
  cape: "Cape",
  shoulders: "Épaules",
  arms: "Bras",
  backpack: "Sac",
};
