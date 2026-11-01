import { getPresentationSnapshot } from "@app/goty";
import { GotyTV } from "@app/goty/ui";
import type { Metadata } from "next";
import { gotyPageError } from "@/lib/goty-pages";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "GOTY Party · Écran TV" };
export default async function GotyTVPage({ params }: { params: Promise<{ editionId: string }> }) {
  const user = await getCurrentMember();
  const { editionId } = await params;
  const initial = await getPresentationSnapshot({ actorId: user.id, editionId }).catch(
    gotyPageError,
  );
  return <GotyTV key={`${editionId}:${user.id}`} initial={initial} viewerId={user.id} />;
}
