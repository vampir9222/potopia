import { IdeaForm } from "@app/ideas/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";
import { sendIdea } from "./actions";

export const metadata: Metadata = { title: "Boîte à idées" };

export default async function IdeasPage() {
  await getCurrentMember();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <Card title="Proposer une idée">
        <p className="text-muted mb-4 text-sm">
          Une idée de carte, d'effet ou de jeu ? Elle part directement aux admins : personne d'autre
          ne la lira, et elle n'apparaît nulle part sur la plateforme.
        </p>
        <IdeaForm action={sendIdea} />
      </Card>
    </div>
  );
}
