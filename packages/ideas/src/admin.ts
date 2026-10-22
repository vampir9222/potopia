import { ForbiddenError, isAdmin } from "@app/core";
import { db } from "@app/db";
import { presignGet } from "@app/storage";
import { z } from "zod";
import { RARITIES, type Rarity } from "./validation";

export type Idea = {
  id: string;
  authorId: string;
  title: string;
  description: string;
  concernedPeople: string | null;
  suggestedRarity: Rarity | null;
  effectIdea: string | null;
  imageKey: string | null;
  createdAt: Date;
};

/** Utilisateur qui lit : seuls les admins (ADMIN_DISCORD_IDS) y ont droit. */
type Reader = { discordId: string | null };

function assertAdmin(reader: Reader): void {
  if (!isAdmin(reader.discordId)) throw new ForbiddenError("Réservé aux admins.");
}

const listFilters = z.object({
  authorId: z.string().min(1).optional(),
  rarity: z.enum(RARITIES).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/** Idées de la plus récente à la plus ancienne. Lève ForbiddenError pour un non-admin. */
export async function listIdeas(
  reader: Reader,
  filters: z.input<typeof listFilters> = {},
): Promise<{ items: Idea[]; nextCursor: string | null }> {
  assertAdmin(reader);
  const { authorId, rarity, cursor, limit } = listFilters.parse(filters);
  const rows = await db.idea.findMany({
    where: { authorId, suggestedRarity: rarity },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
}

/** Lève ForbiddenError pour un non-admin. */
export async function getIdea(reader: Reader, id: string): Promise<Idea | null> {
  assertAdmin(reader);
  return db.idea.findUnique({ where: { id } });
}

/** URL GET présignée (5 min) de l'image d'une idée, ou null. Lève ForbiddenError pour un non-admin. */
export async function getIdeaImageUrl(reader: Reader, id: string): Promise<string | null> {
  const idea = await getIdea(reader, id);
  if (!idea?.imageKey) return null;
  return presignGet({ key: idea.imageKey, expiresIn: 300 });
}

/** Auteurs ayant envoyé au moins une idée, pour le filtre de la liste admin. */
export async function listIdeaAuthorIds(reader: Reader): Promise<string[]> {
  assertAdmin(reader);
  const rows = await db.idea.findMany({ distinct: ["authorId"], select: { authorId: true } });
  return rows.map((r) => r.authorId);
}
