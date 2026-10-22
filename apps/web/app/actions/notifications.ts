"use server";

import { markAllAsRead, markAsRead } from "@app/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionMember } from "@/lib/session";

const notificationId = z.string().min(1).max(100);

export async function markNotificationAsRead(id: string): Promise<void> {
  const user = await actionMember();
  // markAsRead ne touche que les notifications de user.id.
  await markAsRead({ userId: user.id, notificationId: notificationId.parse(id) });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const user = await actionMember();
  await markAllAsRead({ userId: user.id });
  revalidatePath("/", "layout");
}
