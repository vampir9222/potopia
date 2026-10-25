"use server";

import { rateDesign } from "@app/tcg";
import type { RateState } from "@app/tcg/ui";
import { ZodError } from "zod";
import { actionMember } from "@/lib/session";

/** Vote sur un design de carte : ouvert à tous les membres. */
export async function rateDesignAction(_prev: RateState, formData: FormData): Promise<RateState> {
  const member = await actionMember();
  try {
    await rateDesign(member, {
      designId: String(formData.get("designId") ?? ""),
      stars: String(formData.get("stars") ?? ""),
      comment: String(formData.get("comment") ?? ""),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: "error", message: error.issues[0]?.message ?? "Formulaire invalide." };
    }
    throw error;
  }
  // Pas de revalidatePath : la page ne se recharge pas, rien ne bouge quand on note.
  return { status: "ok", message: "Note enregistrée." };
}
