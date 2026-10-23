import { getUsersByIds } from "@app/core";
import { listIdeaAuthorIds, listIdeas, RARITIES, type Rarity } from "@app/ideas";
import { IdeasAdminList } from "@app/ideas/ui";
import { buttonClasses, Card } from "@app/ui";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";
import { loadMoreIdeas } from "./actions";

export const metadata: Metadata = { title: "Boîte à idées" };

function asRarity(value: string | undefined): Rarity | undefined {
  return RARITIES.find((r) => r === value);
}

export default async function AdminIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string; rarity?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const params = await searchParams;
  const filters = { authorId: params.author || undefined, rarity: asRarity(params.rarity) };

  const [{ items, nextCursor }, authorIds] = await Promise.all([
    listIdeas(admin, filters),
    listIdeaAuthorIds(admin),
  ]);
  const authors = await getUsersByIds([...authorIds, ...items.map((i) => i.authorId)]);
  const names = new Map(authors.map((u) => [u.id, u.name]));

  return (
    <Card
      title="Boîte à idées"
      action={
        // Téléchargement de fichier : un vrai <a>, pas <Link> (pas de navigation côté client).
        <a
          href="/api/admin/ideas/export"
          download
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Exporter (JSON)
        </a>
      }
    >
      <IdeasAdminList
        basePath="/admin/ideas"
        filters={filters}
        loadMore={loadMoreIdeas.bind(null, filters)}
        authors={authors
          .filter((u) => authorIds.includes(u.id))
          .map((u) => ({ id: u.id, name: u.name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        initial={{
          nextCursor,
          items: items.map((idea) => ({
            id: idea.id,
            title: idea.title,
            authorName: names.get(idea.authorId) ?? "Membre inconnu",
            rarity: idea.suggestedRarity,
            hasImage: Boolean(idea.imageKey),
            createdAt: idea.createdAt,
          })),
        }}
      />
    </Card>
  );
}
