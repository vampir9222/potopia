"use server";

import { collectItem } from "@app/inventory";
import { refresh } from "next/cache";
import { z } from "zod";
import { actionMember } from "@/lib/session";

const itemId = z.string().min(1).max(50);

/** Ramasse une Émeraude du Chaos cachée dans une page (une seule fois par membre). */
export async function collectEmerald(id: string): Promise<{ isNew: boolean; emeralds: number }> {
  const user = await actionMember();
  const { isNew, emeralds } = await collectItem({ userId: user.id, itemId: itemId.parse(id) });
  // le layout relit l'inventaire : Super Sonic se débloque dès la 7e
  if (isNew) refresh();
  return { isNew, emeralds };
}
