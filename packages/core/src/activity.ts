import { db, type DbTx, type Prisma } from "@app/db";
import { z } from "zod";

export type ActivityEvent = {
  id: string;
  userId: string;
  app: string;
  type: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
};

const publishEventInput = z.object({
  userId: z.string().min(1),
  app: z.string().min(1).max(50),
  type: z.string().min(1).max(50),
  // Visible par tous les membres : ne jamais y mettre de contenu privé.
  payload: z.record(z.string(), z.json()).default({}),
});

export async function publishEvent(
  input: z.input<typeof publishEventInput>,
  opts?: { tx?: DbTx },
): Promise<ActivityEvent> {
  const data = publishEventInput.parse(input);
  return (opts?.tx ?? db).activityEvent.create({
    data: { ...data, payload: data.payload as Prisma.InputJsonObject },
  });
}

/** Nombre maximal d'événements renvoyés, quelle que soit la limite demandée. */
export const MAX_RECENT_EVENTS = 50;

export async function listRecentEvents(limit = 20): Promise<ActivityEvent[]> {
  return db.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), MAX_RECENT_EVENTS),
  });
}

/** Événements publiés après `since` (exclu), du plus ancien au plus récent, MAX_RECENT_EVENTS au plus. */
export async function listEventsSince(since: Date): Promise<ActivityEvent[]> {
  return db.activityEvent.findMany({
    where: { createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take: MAX_RECENT_EVENTS,
  });
}
