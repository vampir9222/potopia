import { getUsersByIds } from "@app/core";
import { listIdeaAuthorIds, listIdeas, RARITIES, type Rarity } from "@app/ideas";
import { IdeasAdminList } from "@app/ideas/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Boîte à idées" };

function asRarity(value: string | undefined): Rarity | undefined {
  return RARITIES.find((r) => r === value);
}

export default async function AdminIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string; rarity?: string; cursor?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const params = await searchParams;
  const filters = { authorId: params.author || undefined, rarity: asRarity(params.rarity) };

  const [{ items, nextCursor }, authorIds] = await Promise.all([
    listIdeas(admin, { ...filters, cursor: params.cursor || undefined }),
    listIdeaAuthorIds(admin),
  ]);
  const authors = await getUsersByIds([...authorIds, ...items.map((i) => i.authorId)]);
  const names = new Map(authors.map((u) => [u.id, u.name]));

  return (
    <Card title="Boîte à idées">
      <IdeasAdminList
        basePath="/admin/ideas"
        filters={filters}
        nextCursor={nextCursor}
        authors={authors
          .filter((u) => authorIds.includes(u.id))
          .map((u) => ({ id: u.id, name: u.name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        items={items.map((idea) => ({
          id: idea.id,
          title: idea.title,
          authorName: names.get(idea.authorId) ?? "Membre inconnu",
          rarity: idea.suggestedRarity,
          hasImage: Boolean(idea.imageKey),
          createdAt: idea.createdAt,
        }))}
      />
    </Card>
  );
}
