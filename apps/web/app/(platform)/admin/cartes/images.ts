import { listIdeaIdsWithImage } from "@app/ideas";
import type { Card } from "@app/tcg";

type Admin = { discordId: string | null };

/**
 * URL d'illustration de chaque carte (par id) : la sienne, ou celle de son idée quand l'idée a une
 * image. Le paramètre `v` change à chaque modification, pour ne pas garder une ancienne image.
 */
export async function cardImageUrls(
  admin: Admin,
  cards: Card[],
): Promise<Map<string, string | null>> {
  const borrowed = new Set(
    await listIdeaIdsWithImage(
      admin,
      cards.flatMap((c) => (!c.imageKey && c.ideaId ? [c.ideaId] : [])),
    ),
  );
  return new Map(
    cards.map((c) => [
      c.id,
      c.imageKey || (c.ideaId && borrowed.has(c.ideaId))
        ? `/api/admin/cards/${c.id}/image?v=${c.updatedAt.getTime()}`
        : null,
    ]),
  );
}

/** Familles déjà utilisées, proposées dans l'éditeur. */
export function familiesOf(cards: Card[]): string[] {
  return [...new Set(cards.flatMap((c) => (c.family ? [c.family] : [])))].sort((a, b) =>
    a.localeCompare(b),
  );
}
