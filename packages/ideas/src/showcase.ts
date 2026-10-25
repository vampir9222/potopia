import { db } from "@app/db";
import { presignGet } from "@app/storage";
import type { Idea } from "./admin";

/**
 * Seule exception à la boîte noire (décidée le 2026-10-25) : l'idée qui sert d'exemple sur la page
 * de vote des designs de cartes est visible de tous les membres, image comprise. Identifiant
 * opaque, aucun contenu d'idée dans le code. Aucune autre idée n'est lisible par un membre.
 */
export const SHOWCASE_IDEA_ID = "01a16567-9812-7766-9662-1e84c2341eae";

/** L'idée exemple et sa place dans la série (n-ième idée reçue sur le total), ou null. */
export type ShowcaseIdea = Idea & { rank: number; total: number };

/** L'idée exemple du vote des designs, pour tout membre connecté (contrôle fait par l'app). */
export async function getShowcaseIdea(): Promise<ShowcaseIdea | null> {
  const idea = await db.idea.findUnique({ where: { id: SHOWCASE_IDEA_ID } });
  if (!idea) return null;
  const [rank, total] = await Promise.all([
    db.idea.count({ where: { createdAt: { lte: idea.createdAt } } }),
    db.idea.count(),
  ]);
  return { ...idea, rank, total };
}

/** URL GET présignée (5 min) de l'image de l'idée exemple, ou null. */
export async function getShowcaseImageUrl(): Promise<string | null> {
  const idea = await db.idea.findUnique({
    where: { id: SHOWCASE_IDEA_ID },
    select: { imageKey: true },
  });
  if (!idea?.imageKey) return null;
  return presignGet({ key: idea.imageKey, expiresIn: 300 });
}
