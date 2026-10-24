import { AGENTS_NAME } from "@app/agents";
import { AgentsLobby } from "@app/agents/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: AGENTS_NAME };

export default async function AgentsPage() {
  await getCurrentMember();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <AgentsLobby />
    </div>
  );
}
