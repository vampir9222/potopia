import { z } from "zod";

/**
 * Mascotte du site. Son visage est celui d'un membre : ses images vivent dans le stockage privé
 * (jamais dans public/ ni dans le repo), envoyées par un admin sur /admin/mascotte et servies aux
 * seuls membres par /api/mascotte/<partie>. Deux parties, animées séparément : le corps et la
 * couronne qui flotte au-dessus.
 */
export const mascotPartSchema = z.enum(["corps", "couronne"]);
export type MascotPart = z.infer<typeof mascotPartSchema>;

/** Clé fixe par partie : un nouvel envoi remplace l'image (gardée au plus 10 min par le navigateur). */
export const mascotKey = (part: MascotPart): string => `site/mascotte/${part}`;

export const MASCOT_TYPES = ["image/png", "image/webp"] as const;
/** Sous la limite d'1 Mo du corps des server actions. */
export const MASCOT_MAX_BYTES = 900_000;
