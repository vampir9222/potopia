import { getUsersByIds, listRecentEvents, MAX_RECENT_EVENTS, type ActivityEvent } from "@app/core";
import type { ActivityItem } from "@app/core/ui";

type Payload = ActivityEvent["payload"];

function numberField(payload: Payload, key: string): number | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Phrase affichée pour chaque type d'événement (`app/type`). Les événements ne portent jamais de
 * contenu privé : seulement des compteurs (score d'une partie…).
 */
const DESCRIPTIONS: Record<string, (payload: Payload) => string> = {
  "avatar/updated": () => "a changé de look",
  "ideas/idea_submitted": () => "a proposé une idée",
  "trois/day_completed": (payload) => {
    const found = numberField(payload, "found");
    const day = numberField(payload, "number");
    const title = day ? `TROIS #${day}` : "TROIS";
    if (found === undefined) return `a fini ${title}`;
    return found === 3 ? `a fait 3 sur 3 à ${title} 🏆` : `a fini ${title} : ${found}/3`;
  },
};

/** Exploit mis en avant en or dans le fil : un 3 sur 3 à TROIS. */
function isFeat(app: string, type: string, payload: Payload): boolean {
  return app === "trois" && type === "day_completed" && numberField(payload, "found") === 3;
}

export function describeEvent(app: string, type: string, payload: Payload = {}): string {
  return DESCRIPTIONS[`${app}/${type}`]?.(payload) ?? "a été actif sur la plateforme";
}

export async function getActivityFeed(limit = MAX_RECENT_EVENTS): Promise<ActivityItem[]> {
  const events = await listRecentEvents(limit);
  const users = new Map((await getUsersByIds(events.map((e) => e.userId))).map((u) => [u.id, u]));
  return events.map((event) => {
    const user = users.get(event.userId);
    return {
      id: event.id,
      user: user ? { name: user.name, image: user.image } : null,
      text: describeEvent(event.app, event.type, event.payload),
      highlight: isFeat(event.app, event.type, event.payload),
      createdAt: event.createdAt,
    };
  });
}
