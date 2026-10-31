import { listIdeaImageUrls } from "@app/ideas";
import { presignGetStable } from "@app/storage";
import type { Card } from "@app/tcg";

type Admin = { discordId: string | null };

/**
 * URL d'illustration de chaque carte (par id) : la sienne, ou celle de son idée quand l'idée a une
 * image. URLs présignées directement (pas de redirection par carte) et stables 5 min, pour que le
 * navigateur garde les images en cache ; une nouvelle illustration a une nouvelle clé, donc une
 * nouvelle URL.
 */
export async function cardImageUrls(
  admin: Admin,
  cards: Card[],
): Promise<Map<string, string | null>> {
  const borrowed = await listIdeaImageUrls(
    admin,
    cards.flatMap((c) => (!c.imageKey && c.ideaId ? [c.ideaId] : [])),
  );
  return new Map(
    await Promise.all(
      cards.map(
        async (c) =>
          [
            c.id,
            c.imageKey
              ? await presignGetStable(c.imageKey)
              : ((c.ideaId && borrowed.get(c.ideaId)) ?? null),
          ] as const,
      ),
    ),
  );
}

/** Familles déjà utilisées, proposées dans l'éditeur. */
export function familiesOf(cards: Card[]): string[] {
  return [...new Set(cards.flatMap((c) => (c.family ? [c.family] : [])))].sort((a, b) =>
    a.localeCompare(b),
  );
}
