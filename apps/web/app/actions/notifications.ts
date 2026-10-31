"use server";

import { ForbiddenError, markAllAsRead, markAsRead, notify } from "@app/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { canSendTestNotification } from "@/lib/notifications";
import { actionMember } from "@/lib/session";

const notificationId = z.string().min(1).max(100);

export async function markNotificationAsRead(id: string): Promise<void> {
  const user = await actionMember();
  // markAsRead ne touche que les notifications de user.id.
  await markAsRead({ userId: user.id, notificationId: notificationId.parse(id) });
  refresh();
}

/**
 * Une notification de test pour soi (Luffy et la cloche, la liste…). En local pour tout le monde,
 * en production pour les admins seulement.
 */
export async function sendTestNotification(): Promise<void> {
  const user = await actionMember();
  if (!canSendTestNotification(user.role)) throw new ForbiddenError();
  await notify({ userId: user.id, title: "Notification de test 🔔", link: "/" });
  refresh();
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const user = await actionMember();
  await markAllAsRead({ userId: user.id });
  refresh();
}
