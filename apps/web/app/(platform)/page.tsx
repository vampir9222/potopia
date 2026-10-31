import { ensureMissingAvatars, getVisibleApps } from "@app/core";
import { AppGrid } from "@app/core/ui";
import { Place } from "@app/avatar/ui";
import { Card, EmptyState } from "@app/ui";
import { HiddenEmerald } from "@app/inventory/ui";
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
    // La place prend toute la hauteur restante de la fenêtre (sur grand écran, la page y tient).
    <div className="relative flex min-h-[calc(100dvh-6.5rem)] flex-col gap-4 lg:h-[calc(100dvh-6.5rem)]">
      <Card title="Apps">
        {apps.length > 0 ? (
          <AppGrid apps={apps} />
        ) : (
          <EmptyState title="Aucune app pour l'instant" description="Les jeux arrivent bientôt." />
        )}
      </Card>
      <Card
        title="La place"
        className="flex min-h-0 flex-1 flex-col"
        action={
          <Link href="/credits" className="text-muted hover:text-text text-xs">
            Crédits des graphismes
          </Link>
        }
      >
        <Place initial={place} layout={avatarLayout} className="flex-1" />
      </Card>
      <HiddenEmerald color="green" className="absolute -bottom-3 left-1" />
    </div>
  );
}
