import { randomUUID } from "node:crypto";
import { db, withTx, type DbTx } from "@app/db";
import { z } from "zod";
import { IdempotencyConflictError, InsufficientFundsError } from "./errors";

export type Transaction = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  ref: string | null;
  idempotencyKey: string;
  balanceAfter: number;
  actorId: string | null;
  createdAt: Date;
};

type TransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  ref: string | null;
  idempotency_key: string;
  balance_after: number;
  actor_id: string | null;
  created_at: Date;
};

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    reason: row.reason,
    ref: row.ref,
    idempotencyKey: row.idempotency_key,
    balanceAfter: row.balance_after,
    actorId: row.actor_id,
    createdAt: row.created_at,
  };
}

// Plafond par opération, loin de la limite d'une colonne integer (2^31 - 1).
export const MAX_AMOUNT = 1_000_000_000;

const operationInput = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive().max(MAX_AMOUNT),
  reason: z.string().trim().min(1).max(200),
  ref: z.string().max(200).optional(),
  // Fournie par l'appelant : rejouer la même opération (double clic, retry) ne crédite qu'une fois.
  idempotencyKey: z.string().min(1).max(200),
  actorId: z.string().min(1).optional(),
});

export type OperationInput = z.input<typeof operationInput>;

/**
 * Crédit (delta > 0) ou débit (delta < 0), en une transaction SQL :
 * wallet créé si besoin puis verrouillé (FOR UPDATE), rejeu idempotent, contrôle du solde,
 * INSERT … ON CONFLICT (idempotency_key) DO NOTHING, mise à jour du solde.
 * SQL brut plutôt que rattraper l'erreur P2002 : une erreur annule toute la transaction Postgres.
 */
export async function applyOperation(
  input: OperationInput,
  sign: 1 | -1,
  opts?: { tx?: DbTx },
): Promise<{ transaction: Transaction; replayed: boolean }> {
  const op = operationInput.parse(input);
  const delta = sign * op.amount;

  return withTx(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "economy"."wallets" ("user_id") VALUES (${op.userId})
      ON CONFLICT ("user_id") DO NOTHING`;
    const [wallet] = await tx.$queryRaw<{ balance: number }[]>`
      SELECT "balance" FROM "economy"."wallets" WHERE "user_id" = ${op.userId} FOR UPDATE`;
    if (!wallet) throw new Error(`Wallet introuvable pour ${op.userId}.`);

    // Rejeu : la même opération renvoie la transaction d'origine, même si le solde a changé depuis.
    const replayed = await findByKey(tx, op.idempotencyKey);
    if (replayed) return checkReplay(replayed, op.userId, delta);

    const balanceAfter = wallet.balance + delta;
    if (balanceAfter < 0) throw new InsufficientFundsError(wallet.balance, op.amount);

    const [inserted] = await tx.$queryRaw<TransactionRow[]>`
      INSERT INTO "economy"."transactions"
        ("id", "user_id", "amount", "reason", "ref", "idempotency_key", "balance_after", "actor_id")
      VALUES (${randomUUID()}, ${op.userId}, ${delta}, ${op.reason}, ${op.ref ?? null},
        ${op.idempotencyKey}, ${balanceAfter}, ${op.actorId ?? null})
      ON CONFLICT ("idempotency_key") DO NOTHING
      RETURNING *`;
    if (!inserted) {
      // Même clé insérée entre-temps pour un autre wallet (le verrou ne couvre que celui-ci).
      const existing = await findByKey(tx, op.idempotencyKey);
      if (!existing) throw new Error("Conflit d'idempotence introuvable.");
      return checkReplay(existing, op.userId, delta);
    }

    await tx.$executeRaw`
      UPDATE "economy"."wallets" SET "balance" = ${balanceAfter}, "updated_at" = now()
      WHERE "user_id" = ${op.userId}`;
    return { transaction: toTransaction(inserted), replayed: false };
  }, opts);
}

async function findByKey(tx: DbTx, idempotencyKey: string): Promise<Transaction | null> {
  const [row] = await tx.$queryRaw<TransactionRow[]>`
    SELECT * FROM "economy"."transactions" WHERE "idempotency_key" = ${idempotencyKey}`;
  return row ? toTransaction(row) : null;
}

function checkReplay(
  existing: Transaction,
  userId: string,
  delta: number,
): { transaction: Transaction; replayed: true } {
  if (existing.userId !== userId || existing.amount !== delta) {
    throw new IdempotencyConflictError(existing.idempotencyKey);
  }
  return { transaction: existing, replayed: true };
}

export async function credit(input: OperationInput, opts?: { tx?: DbTx }): Promise<Transaction> {
  return (await applyOperation(input, 1, opts)).transaction;
}

/** Lève InsufficientFundsError si le solde ne couvre pas le montant. */
export async function debit(input: OperationInput, opts?: { tx?: DbTx }): Promise<Transaction> {
  return (await applyOperation(input, -1, opts)).transaction;
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await db.wallet.findUnique({ where: { userId }, select: { balance: true } });
  return wallet?.balance ?? 0;
}

/** Soldes de plusieurs membres en une requête ; 0 pour ceux qui n'ont pas de wallet. */
export async function getBalances(userIds: readonly string[]): Promise<Map<string, number>> {
  const wallets = await db.wallet.findMany({
    where: { userId: { in: [...new Set(userIds)] } },
    select: { userId: true, balance: true },
  });
  const balances = new Map(userIds.map((id) => [id, 0]));
  for (const w of wallets) balances.set(w.userId, w.balance);
  return balances;
}

/** Historique du plus récent au plus ancien. `cursor` = `nextCursor` de la page précédente. */
export async function getHistory(
  userId: string,
  { limit = 20, cursor }: { limit?: number; cursor?: string } = {},
): Promise<{ items: Transaction[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await db.transaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, take);
  return { items, nextCursor: rows.length > take ? (items.at(-1)?.id ?? null) : null };
}
