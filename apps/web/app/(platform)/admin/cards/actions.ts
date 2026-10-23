"use server";

import { rateDesign } from "@app/tcg";
import type { RateState } from "@app/tcg/ui";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { actionAdmin } from "@/lib/session";

export async function rateDesignAction(_prev: RateState, formData: FormData): Promise<RateState> {
  const admin = await actionAdmin();
  try {
    await rateDesign(admin, {
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
  revalidatePath("/admin/cards");
  return { status: "ok", message: "Note enregistrée." };
}
