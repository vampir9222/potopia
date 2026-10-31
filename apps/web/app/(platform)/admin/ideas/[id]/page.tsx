import { getUser } from "@app/core";
import { getIdea } from "@app/ideas";
import { IdeaDetail } from "@app/ideas/ui";
import { listCards } from "@app/tcg";
import { buttonClasses, Card } from "@app/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Idée" };

export default async function AdminIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  const idea = await getIdea(admin, id);
  if (!idea) notFound();
  const [author, cards] = await Promise.all([
    getUser(idea.authorId),
    listCards(admin, { ideaId: idea.id }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <IdeaDetail
          idea={idea}
          authorName={author?.name ?? "Membre inconnu"}
          imageSrc={idea.imageKey ? `/api/admin/ideas/${idea.id}/image` : null}
        />
      </Card>
      <Card
        title="Cartes tirées de cette idée"
        action={
          <Link
            href={`/admin/cartes/nouvelle?idee=${idea.id}`}
            className={buttonClasses({ size: "sm" })}
          >
            {cards.length > 0 ? "Créer une autre carte" : "Créer une carte"}
          </Link>
        }
      >
        {cards.length === 0 ? (
          <p className="text-muted text-sm">
            Aucune carte pour l&apos;instant. La création reprend le titre, la description, la
            rareté et l&apos;image proposés.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {cards.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/cartes/${c.id}`} className="text-accent hover:underline">
                  {c.name}
                </Link>{" "}
                <span className="text-muted">
                  · {c.setCode ? `${c.setCode} n°${c.number}` : "réserve"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
