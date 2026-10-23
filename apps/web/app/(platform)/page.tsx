import { ensureMissingAvatars, getVisibleApps } from "@app/core";
import { AppGrid } from "@app/core/ui";
import { Place } from "@app/avatar/ui";
import { Card, EmptyState } from "@app/ui";
import Link from "next/link";
import { after } from "next/server";
import { avatarLayout, getOwnAvatar, getPlaceSnapshot, sprites } from "@/lib/avatar";
import { getCurrentMember } from "@/lib/session";

export default async function DashboardPage() {
  const user = await getCurrentMember();
  const apps = getVisibleApps(user);
  // Son propre avatar d'abord, pour apparaître sur la place dès la première visite.
  await getOwnAvatar(user.id);
  const place = await getPlaceSnapshot();
  // Les membres sans avatar en reçoivent un après la réponse : ils rejoignent la place au rafraîchissement.
  after(() =>
    ensureMissingAvatars({ sprites }).catch((error) => console.error("Avatars :", error)),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card title="Apps">
        {apps.length > 0 ? (
          <AppGrid apps={apps} />
        ) : (
          <EmptyState title="Aucune app pour l'instant" description="Les jeux arrivent bientôt." />
        )}
      </Card>
      <Card
        title="La place"
        action={
          <Link href="/credits" className="text-muted hover:text-text text-xs">
            Crédits des graphismes
          </Link>
        }
      >
        <Place initial={place} layout={avatarLayout} />
      </Card>
    </div>
  );
}
