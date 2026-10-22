import { db, type DbTx } from "@app/db";
import { z } from "zod";
import { isAdmin } from "./access/admin";

export type Notification = {
  id: string;
  userId: string;
  title: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const content = {
  title: z.string().min(1).max(200),
  // Lien interne uniquement (`/admin/ideas`), jamais une URL externe.
  link: z
    .string()
    .regex(/^\/(?!\/)/, "Lien interne attendu.")
    .max(500)
    .optional(),
};
const notifyInput = z.object({ userId: z.string().min(1), ...content });
const notifyAdminsInput = z.object(content);

export async function notify(
  input: z.input<typeof notifyInput>,
  opts?: { tx?: DbTx },
): Promise<Notification> {
  const data = notifyInput.parse(input);
  return (opts?.tx ?? db).notification.create({ data });
}

/** Notifie chaque admin (ADMIN_DISCORD_IDS) qui s'est déjà connecté au moins une fois. */
export async function notifyAdmins(
  input: z.input<typeof notifyAdminsInput>,
  opts?: { tx?: DbTx },
): Promise<number> {
  const data = notifyAdminsInput.parse(input);
  const client = opts?.tx ?? db;
  const candidates = await client.user.findMany({
    where: { discordId: { not: null } },
    select: { id: true, discordId: true },
  });
  const admins = candidates.filter((u) => isAdmin(u.discordId));
  if (admins.length === 0) return 0;
  const { count } = await client.notification.createMany({
    data: admins.map((admin) => ({ ...data, userId: admin.id })),
  });
  return count;
}

export async function listNotifications(userId: string, limit = 20): Promise<Notification[]> {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
}

export async function countUnread(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

const markAsReadInput = z.object({ userId: z.string().min(1), notificationId: z.string().min(1) });

/** Ne touche qu'une notification de `userId` : renvoie false si elle n'existe pas ou appartient à un autre. */
export async function markAsRead(
  input: z.input<typeof markAsReadInput>,
  opts?: { tx?: DbTx },
): Promise<boolean> {
  const { userId, notificationId } = markAsReadInput.parse(input);
  const client = opts?.tx ?? db;
  await client.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return (await client.notification.count({ where: { id: notificationId, userId } })) > 0;
}

export async function markAllAsRead(
  input: { userId: string },
  opts?: { tx?: DbTx },
): Promise<number> {
  const { count } = await (opts?.tx ?? db).notification.updateMany({
    where: { userId: input.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}
