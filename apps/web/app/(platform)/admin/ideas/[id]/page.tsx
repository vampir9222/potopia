import { getUser } from "@app/core";
import { getIdea } from "@app/ideas";
import { IdeaDetail } from "@app/ideas/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Idée" };

export default async function AdminIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  const { id } = await params;
  const idea = await getIdea(admin, id);
  if (!idea) notFound();
  const author = await getUser(idea.authorId);

  return (
    <Card>
      <IdeaDetail
        idea={idea}
        authorName={author?.name ?? "Membre inconnu"}
        imageSrc={idea.imageKey ? `/api/admin/ideas/${idea.id}/image` : null}
      />
    </Card>
  );
}
