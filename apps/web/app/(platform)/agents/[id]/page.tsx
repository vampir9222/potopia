import { AGENTS_NAME } from "@app/agents";
import { AgentsGame } from "@app/agents/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: AGENTS_NAME };

/** Une partie : le client charge l'état par l'API (le serveur vérifie que c'est la mienne). */
export default async function AgentsGamePage({ params }: { params: Promise<{ id: string }> }) {
  await getCurrentMember();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <AgentsGame id={(await params).id} />
    </div>
  );
}
