import { CATEGORIES, MORPHS, type Category, type ColorId, type Morph } from "@app/avatar-assets";
import { z } from "zod";

const colorId = z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/, "Couleur invalide.");

export const avatarItemSchema = z.object({
  id: z.string().min(1).max(100),
  /** Couleur par emplacement (`main`, `color_1`…) ; un emplacement absent garde sa couleur d'origine. */
  colors: z.record(z.string().max(20), colorId).optional(),
});

/** Forme d'une config d'avatar. Sa cohérence avec le catalogue est vérifiée par `checkConfig`. */
export const avatarConfigSchema = z.object({
  v: z.literal(1),
  morph: z.enum(MORPHS),
  /** Couleur de peau : corps, tête et visage. */
  skin: colorId,
  /** Couleur des yeux. */
  eyes: colorId,
  items: z.partialRecord(z.enum(CATEGORIES), avatarItemSchema),
});

export type AvatarItemChoice = z.infer<typeof avatarItemSchema>;
export type AvatarConfig = {
  v: 1;
  morph: Morph;
  skin: ColorId;
  eyes: ColorId;
  items: Partial<Record<Category, AvatarItemChoice>>;
};
