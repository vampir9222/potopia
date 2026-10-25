"use server";

import { formatCurrency } from "@app/config/brand";
import { getUser } from "@app/core";
import {
  adminAdjust,
  BalanceLimitError,
  IdempotencyConflictError,
  InsufficientFundsError,
  MAX_BALANCE,
} from "@app/economy";
import type { AdjustState } from "@app/economy/ui";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionAdmin } from "@/lib/session";

const adjustForm = z.object({
  userId: z.string().min(1, "Choisis un membre."),
  direction: z.enum(["credit", "debit"]),
  amount: z.coerce.number().int("Montant entier attendu.").positive("Montant positif attendu."),
  reason: z.string().trim().min(3, "Le motif est obligatoire (3 caractères minimum).").max(200),
  idempotencyKey: z.string().min(1).max(200),
});

export async function adjustBalance(_prev: AdjustState, formData: FormData): Promise<AdjustState> {
  const admin = await actionAdmin();
  const parsed = adjustForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const { userId, direction, amount, reason, idempotencyKey } = parsed.data;
  const member = await getUser(userId);
  if (!member) return { status: "error", message: "Membre introuvable." };

  try {
    await adminAdjust({
      actorId: admin.id,
      userId,
      amount: direction === "credit" ? amount : -amount,
      reason,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return {
        status: "error",
        message: `Solde insuffisant : ${member.name} n'a que ${formatCurrency(error.balance)}.`,
      };
    }
    if (error instanceof BalanceLimitError) {
      return {
        status: "error",
        message: `Plafond de solde atteint : ${member.name} a déjà ${formatCurrency(error.balance)}, le maximum est ${formatCurrency(MAX_BALANCE)}.`,
      };
    }
    if (error instanceof IdempotencyConflictError) {
      return { status: "error", message: "Formulaire déjà envoyé : recharge la page." };
    }
    throw error;
  }

  revalidatePath("/admin/economy");
  const verb = direction === "credit" ? "crédité" : "débité";
  return { status: "ok", message: `${member.name} ${verb} de ${formatCurrency(amount)}.` };
}
