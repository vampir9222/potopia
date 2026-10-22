import { randomUUID } from "node:crypto";
import { formatCurrency } from "@app/config/brand";
import { ForbiddenError, getUser, isAdmin, notify } from "@app/core";
import { withTx, type DbTx } from "@app/db";
import { z } from "zod";
import { applyOperation, MAX_AMOUNT, type Transaction } from "./ledger";

const adminAdjustInput = z.object({
  actorId: z.string().min(1),
  userId: z.string().min(1),
  // Signé : positif = crédit, négatif = débit.
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, "Le montant ne peut pas être nul.")
    .refine((n) => Math.abs(n) <= MAX_AMOUNT, "Montant trop élevé."),
  reason: z.string().trim().min(3, "Le motif est obligatoire.").max(200),
  // Générée par le formulaire : une double soumission n'applique l'ajustement qu'une fois.
  idempotencyKey: z.string().min(1).max(200).optional(),
});

/**
 * Ajustement manuel par un admin : crédit ou débit avec motif obligatoire, puis notification
 * du membre, dans la même transaction. Revérifie que l'acteur est admin (défense en profondeur,
 * l'appelant a déjà fait requireAdmin).
 */
export async function adminAdjust(
  input: z.input<typeof adminAdjustInput>,
  opts?: { tx?: DbTx },
): Promise<Transaction> {
  const { actorId, userId, amount, reason, idempotencyKey } = adminAdjustInput.parse(input);
  const [actor, target] = await Promise.all([getUser(actorId), getUser(userId)]);
  if (!actor || !isAdmin(actor.discordId)) throw new ForbiddenError("Réservé aux admins.");
  if (!target) throw new Error("Membre introuvable.");

  return withTx(async (tx) => {
    const operation = {
      userId,
      amount: Math.abs(amount),
      reason,
      actorId,
      idempotencyKey: idempotencyKey ?? `admin:${randomUUID()}`,
    };
    const { transaction, replayed } = await applyOperation(operation, amount > 0 ? 1 : -1, {
      tx,
    });
    // Double soumission du formulaire : l'ajustement et sa notification existent déjà.
    if (replayed) return transaction;
    const verb = amount > 0 ? "crédité" : "débité";
    await notify(
      {
        userId,
        title: `Un admin t'a ${verb} de ${formatCurrency(Math.abs(amount))} : ${reason}`,
        link: "/",
      },
      { tx },
    );
    return transaction;
  }, opts);
}
