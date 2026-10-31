import { presignGet } from "@app/storage";
import { z } from "zod";

/**
 * Mascotte du site. Son visage est celui d'un membre : ses images vivent dans le stockage privé
 * (jamais dans public/ ni dans le repo), envoyées par un admin sur /admin/mascotte et servies aux
 * seuls membres par /api/mascotte/<partie>. Deux parties, animées séparément : le corps et la
 * couronne qui flotte au-dessus. Ses phrases (répliques du groupe, donc jamais dans le repo non
 * plus) sont au même endroit, servies par /api/mascotte/phrases.
 */
export const mascotPartSchema = z.enum(["corps", "couronne"]);
export type MascotPart = z.infer<typeof mascotPartSchema>;

/** Clé fixe par partie : un nouvel envoi remplace l'image (gardée au plus 10 min par le navigateur). */
export const mascotKey = (part: MascotPart): string => `site/mascotte/${part}`;

export const MASCOT_TYPES = ["image/png", "image/webp"] as const;
/** Sous la limite d'1 Mo du corps des server actions. */
export const MASCOT_MAX_BYTES = 900_000;

export const MASCOT_PHRASES_KEY = "site/mascotte/phrases";
export const mascotPhrasesSchema = z
  .array(z.string().trim().min(1).max(80, "Une phrase fait 80 caractères au plus."))
  .max(50, "50 phrases au plus.");

/** Phrases de la mascotte (liste vide si aucune n'a été enregistrée). */
export async function readMascotPhrases(): Promise<string[]> {
  const res = await fetch(await presignGet({ key: MASCOT_PHRASES_KEY }), { cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Phrases de la mascotte illisibles (${res.status}).`);
  const parsed = mascotPhrasesSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : [];
}
