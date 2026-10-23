"use server";

import type { AvatarSaveState } from "@app/avatar/ui";
import { AvatarConfigError, saveAvatar } from "@app/core";
import { revalidatePath } from "next/cache";
import { sprites } from "@/lib/avatar";
import { actionMember } from "@/lib/session";

/** Enregistre l'avatar du membre connecté : la config reçue est revalidée par le serveur. */
export async function saveAvatarAction(config: unknown): Promise<AvatarSaveState> {
  const user = await actionMember();
  try {
    await saveAvatar({ userId: user.id, config, sprites });
  } catch (error) {
    if (error instanceof AvatarConfigError) return { status: "error", message: error.message };
    throw error;
  }
  // Place du dashboard : nouvelle planche.
  revalidatePath("/", "layout");
  return { status: "ok" };
}
