import { getUsersByIds, listRecentEvents } from "@app/core";
import type { ActivityItem } from "@app/core/ui";

/**
 * Phrase affichée pour chaque type d'événement (`app/type`). Les événements ne portent jamais de
 * contenu privé : la phrase ne dépend que du type.
 */
const DESCRIPTIONS: Record<string, string> = {
  "ideas/idea_submitted": "a proposé une idée",
};

export function describeEvent(app: string, type: string): string {
  return DESCRIPTIONS[`${app}/${type}`] ?? "a été actif sur la plateforme";
}

export async function getActivityFeed(limit = 20): Promise<ActivityItem[]> {
  const events = await listRecentEvents(limit);
  const users = new Map((await getUsersByIds(events.map((e) => e.userId))).map((u) => [u.id, u]));
  return events.map((event) => {
    const user = users.get(event.userId);
    return {
      id: event.id,
      user: user ? { name: user.name, image: user.image } : null,
      text: describeEvent(event.app, event.type),
      createdAt: event.createdAt,
    };
  });
}
