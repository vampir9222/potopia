import { getEdition, listEditions } from "@app/goty";
import { GotyHome } from "@app/goty/ui";
import type { Metadata } from "next";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "GOTY Party" };
export default async function GotyPage() {
  const user = await getCurrentMember();
  const editions = await listEditions(user.id);
  const permissions = await Promise.all(
    editions.map((edition) => getEdition({ actorId: user.id, editionId: edition.id })),
  );
  const canCreate = user.role === "admin" || permissions.some((view) => view.permissions.organize);
  return <GotyHome editions={editions} canCreate={canCreate} year={new Date().getFullYear()} />;
}
