import { getVisibleApps } from "@app/core";
import { AppGrid } from "@app/core/ui";
import { Card, EmptyState } from "@app/ui";
import { getCurrentMember } from "@/lib/session";

export default async function DashboardPage() {
  const user = await getCurrentMember();
  const apps = getVisibleApps(user);

  return (
    <Card title="Apps">
      {apps.length > 0 ? (
        <AppGrid apps={apps} />
      ) : (
        <EmptyState title="Aucune app pour l'instant" description="Les jeux arrivent bientôt." />
      )}
    </Card>
  );
}
