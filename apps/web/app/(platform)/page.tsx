import { getVisibleApps } from "@app/core";
import { ActivityFeed, AppGrid } from "@app/core/ui";
import { Card, EmptyState } from "@app/ui";
import { getActivityFeed } from "@/lib/activity";
import { getCurrentMember } from "@/lib/session";

export default async function DashboardPage() {
  const user = await getCurrentMember();
  const apps = getVisibleApps(user);
  const feed = await getActivityFeed();

  return (
    <div className="flex flex-col gap-6">
      <Card title="Apps">
        {apps.length > 0 ? (
          <AppGrid apps={apps} />
        ) : (
          <EmptyState title="Aucune app pour l'instant" description="Les jeux arrivent bientôt." />
        )}
      </Card>
      <Card title="Activité récente">
        <ActivityFeed items={feed} />
      </Card>
    </div>
  );
}
