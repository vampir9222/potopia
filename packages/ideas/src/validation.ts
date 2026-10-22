import { z } from "zod";

export const RARITIES = ["common", "uncommon", "rare", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  legendary: "Légendaire",
};

export const LIMITS = {
  title: 100,
  description: 2000,
  concernedPeople: 200,
  effectIdea: 1000,
  imageBytes: 5 * 1024 * 1024,
  ideasPerHour: 5,
  uploadsPerHour: 10,
} as const;

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;

/** Champ texte facultatif : une chaîne vide (formulaire) vaut « absent ». */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum.`)
    .optional()
    .transform((value) => value || undefined);
}

export const ideaInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Le titre est obligatoire.")
    .max(LIMITS.title, `Titre : ${LIMITS.title} caractères maximum.`),
  description: z
    .string()
    .trim()
    .min(1, "La description est obligatoire.")
    .max(LIMITS.description, `Description : ${LIMITS.description} caractères maximum.`),
  concernedPeople: optionalText(LIMITS.concernedPeople, "Personnes concernées"),
  suggestedRarity: z
    .enum(RARITIES, "Rareté invalide.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  effectIdea: optionalText(LIMITS.effectIdea, "Idée d'effet"),
  // Clé émise par createUploadUrl. Son format est vérifié, son origine l'est en base.
  imageKey: z
    .string()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
});
/** Entrée brute (formulaire) : tout est validé par ideaInput. */
export type IdeaInput = {
  title: string;
  description: string;
  concernedPeople?: string;
  suggestedRarity?: string;
  effectIdea?: string;
  imageKey?: string;
};

export const uploadInput = z.object({
  contentType: z.enum(Object.keys(IMAGE_TYPES) as [ImageType, ...ImageType[]], {
    error: "Format d'image refusé (JPEG, PNG ou WebP).",
  }),
  size: z
    .number()
    .int()
    .positive("Image vide.")
    .max(LIMITS.imageBytes, "Image trop lourde (5 Mo maximum)."),
});
/** Entrée brute (navigateur) : type et taille sont validés par uploadInput. */
export type UploadInput = { contentType: string; size: number };
