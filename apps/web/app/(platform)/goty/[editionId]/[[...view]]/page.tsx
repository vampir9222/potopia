import { getMemberSnapshot, listEditions } from "@app/goty";
import { GotyApp, type GotyView } from "@app/goty/ui";
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { gotyPageError } from "@/lib/goty-pages";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "GOTY Party" };
export default async function GotyEditionPage({
  params,
}: {
  params: Promise<{ editionId: string; view?: string[] }>;
}) {
  const user = await getCurrentMember();
  const { editionId, view } = await params;
  const page = view?.[0] ?? "accueil";
  if (
    (view?.length ?? 0) > 1 ||
    ![
      "accueil",
      "jeux",
      "palmares",
      "categories",
      "pronostics",
      "organisation",
      "ceremonie",
      "archives",
    ].includes(page)
  )
    notFound();
  const initial = await getMemberSnapshot({ actorId: user.id, editionId }).catch(gotyPageError);
  if (page === "organisation" && !initial.permissions.organize && !initial.permissions.present)
    forbidden();
  return (
    <GotyApp
      key={`${editionId}:${user.id}`}
      initial={initial}
      userId={user.id}
      isAdmin={user.role === "admin"}
      editions={await listEditions(user.id)}
      page={page as GotyView}
    />
  );
}
