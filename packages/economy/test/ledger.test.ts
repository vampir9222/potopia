import { randomUUID } from "node:crypto";
import { listNotifications } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import {
  adminAdjust,
  BalanceLimitError,
  credit,
  debit,
  getBalance,
  getBalances,
  getHistory,
  IdempotencyConflictError,
  InsufficientFundsError,
  MAX_AMOUNT,
  MAX_BALANCE,
} from "../src/index";

const USER = "user-1";
const OTHER = "user-2";
const key = () => randomUUID();

async function ledgerSum(userId: string): Promise<number> {
  const { _sum } = await db.transaction.aggregate({ where: { userId }, _sum: { amount: true } });
  return _sum.amount ?? 0;
}

beforeEach(truncateTestDb);

describe("credit / debit", () => {
  it("crédite puis débite en tenant balanceAfter à jour", async () => {
    const c = await credit({
      userId: USER,
      amount: 100,
      reason: "Bienvenue",
      idempotencyKey: key(),
    });
    const d = await debit({ userId: USER, amount: 30, reason: "Achat", idempotencyKey: key() });

    expect(c).toMatchObject({ amount: 100, balanceAfter: 100 });
    expect(d).toMatchObject({ amount: -30, balanceAfter: 70 });
    expect(await getBalance(USER)).toBe(70);
  });

  it("un solde inconnu vaut 0", async () => {
    expect(await getBalance("inconnu")).toBe(0);
  });

  it("même idempotencyKey = un seul crédit, et le même résultat renvoyé", async () => {
    const input = { userId: USER, amount: 50, reason: "Gain", idempotencyKey: key() };
    const first = await credit(input);
    const again = await credit(input);
    const parallel = await Promise.all([credit(input), credit(input), credit(input)]);

    for (const t of [again, ...parallel]) expect(t).toEqual(first);
    expect(await getBalance(USER)).toBe(50);
    expect(await db.transaction.count()).toBe(1);
  });

  it("le rejeu d'un débit réussi renvoie la transaction même si le solde a changé", async () => {
    await credit({ userId: USER, amount: 10, reason: "Gain", idempotencyKey: key() });
    const input = { userId: USER, amount: 10, reason: "Achat", idempotencyKey: key() };
    const first = await debit(input);
    expect(await debit(input)).toEqual(first);
  });

  it("refuse une clé réutilisée pour une autre opération", async () => {
    const k = key();
    await credit({ userId: USER, amount: 50, reason: "Gain", idempotencyKey: k });
    await expect(
      credit({ userId: USER, amount: 60, reason: "Gain", idempotencyKey: k }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(
      credit({ userId: OTHER, amount: 50, reason: "Gain", idempotencyKey: k }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await getBalance(OTHER)).toBe(0);
  });

  it("un débit supérieur au solde est refusé et ne laisse aucune trace", async () => {
    await credit({ userId: USER, amount: 20, reason: "Gain", idempotencyKey: key() });
    await expect(
      debit({ userId: USER, amount: 21, reason: "Achat", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    await expect(
      debit({ userId: OTHER, amount: 1, reason: "Achat", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect(await getBalance(USER)).toBe(20);
    expect(await db.transaction.count()).toBe(1);
    // Le wallet créé pour le débit refusé a été annulé avec la transaction.
    expect(await db.wallet.findUnique({ where: { userId: OTHER } })).toBeNull();
  });

  it("un crédit qui dépasserait le plafond de solde est refusé et ne laisse aucune trace", async () => {
    await credit({ userId: USER, amount: MAX_BALANCE, reason: "Gain", idempotencyKey: key() });
    await expect(
      credit({ userId: USER, amount: 1, reason: "Gain", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(BalanceLimitError);
    // Plusieurs crédits au plafond par opération : la colonne integer ne déborde jamais.
    await expect(
      credit({ userId: USER, amount: MAX_AMOUNT, reason: "Gain", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(BalanceLimitError);

    expect(await getBalance(USER)).toBe(MAX_BALANCE);
    expect(await db.transaction.count()).toBe(1);
  });

  it("refuse les montants nuls, négatifs ou non entiers", async () => {
    for (const amount of [0, -5, 1.5]) {
      await expect(
        credit({ userId: USER, amount, reason: "x", idempotencyKey: key() }),
      ).rejects.toThrow();
    }
  });

  it("respecte la transaction passée en option", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await credit({ userId: USER, amount: 10, reason: "Gain", idempotencyKey: key() }, { tx });
        throw new Error("annulation");
      }),
    ).rejects.toThrow("annulation");
    expect(await getBalance(USER)).toBe(0);
    expect(await db.transaction.count()).toBe(0);
  });
});

describe("concurrence et invariants", () => {
  it("20 débits concurrents sur un solde limité : jamais de solde négatif", async () => {
    await credit({ userId: USER, amount: 100, reason: "Gain", idempotencyKey: key() });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        debit({ userId: USER, amount: 15, reason: "Achat", idempotencyKey: key() }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof InsufficientFundsError,
    );

    expect(ok).toHaveLength(6);
    expect(refused).toHaveLength(14);
    expect(await getBalance(USER)).toBe(10);
    expect(await ledgerSum(USER)).toBe(10);
  });

  it("après des opérations aléatoires, le solde est égal à la somme du ledger", async () => {
    // Générateur déterministe : un échec est reproductible.
    let seed = 42;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const users = [USER, OTHER];

    await Promise.all(
      Array.from({ length: 60 }, async () => {
        const userId = users[Math.floor(random() * users.length)] ?? USER;
        const amount = 1 + Math.floor(random() * 50);
        const op = random() < 0.6 ? credit : debit;
        await op({ userId, amount, reason: "Aléatoire", idempotencyKey: key() }).catch((e) => {
          if (!(e instanceof InsufficientFundsError)) throw e;
        });
      }),
    );

    for (const userId of users) {
      const balance = await getBalance(userId);
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(balance).toBe(await ledgerSum(userId));
      const [last] = (await getHistory(userId, { limit: 1 })).items;
      expect(last?.balanceAfter ?? 0).toBe(balance);
    }
  });
});

describe("garde-fous SQL", () => {
  it("un UPDATE ou un DELETE sur transactions lève une erreur", async () => {
    await credit({ userId: USER, amount: 10, reason: "Gain", idempotencyKey: key() });
    await expect(
      db.$executeRaw`UPDATE "economy"."transactions" SET "amount" = 1000`,
    ).rejects.toThrow(/ajout seul/);
    await expect(db.$executeRaw`DELETE FROM "economy"."transactions"`).rejects.toThrow(
      /ajout seul/,
    );
    expect(await ledgerSum(USER)).toBe(10);
  });

  it("CHECK : solde négatif et montant nul refusés par la base", async () => {
    await credit({ userId: USER, amount: 10, reason: "Gain", idempotencyKey: key() });
    await expect(db.$executeRaw`UPDATE "economy"."wallets" SET "balance" = -1`).rejects.toThrow(
      /wallets_balance_non_negative/,
    );
    await expect(
      db.$executeRaw`INSERT INTO "economy"."transactions"
        ("id", "user_id", "amount", "reason", "idempotency_key", "balance_after")
        VALUES ('t', ${USER}, 0, 'x', 'k', 10)`,
    ).rejects.toThrow(/transactions_amount_non_zero/);
  });
});

describe("getHistory", () => {
  it("pagine du plus récent au plus ancien", async () => {
    for (let i = 1; i <= 5; i++) {
      await credit({ userId: USER, amount: i, reason: `Gain ${i}`, idempotencyKey: key() });
    }
    const page1 = await getHistory(USER, { limit: 2 });
    const page2 = await getHistory(USER, { limit: 2, cursor: page1.nextCursor ?? undefined });
    const page3 = await getHistory(USER, { limit: 2, cursor: page2.nextCursor ?? undefined });

    expect([...page1.items, ...page2.items, ...page3.items].map((t) => t.amount)).toEqual([
      5, 4, 3, 2, 1,
    ]);
    expect(page3.nextCursor).toBeNull();
  });
});

describe("adminAdjust", () => {
  const ADMIN = "user-admin";

  beforeEach(async () => {
    await db.user.createMany({
      data: [
        { id: ADMIN, discordId: "100000000000000001", name: "Admin", email: "admin@example.test" },
        { id: USER, discordId: "100000000000000002", name: "Membre", email: "m@example.test" },
      ],
    });
  });

  it("crédite avec motif, trace l'admin et notifie le membre", async () => {
    const t = await adminAdjust({ actorId: ADMIN, userId: USER, amount: 1500, reason: "Tournoi" });
    expect(t).toMatchObject({ amount: 1500, actorId: ADMIN, reason: "Tournoi" });

    const [notification] = await listNotifications(USER);
    expect(notification?.title).toContain("crédité");
    expect(notification?.title).toContain("Tournoi");
  });

  it("débite, et refuse un débit au-delà du solde sans notifier", async () => {
    await adminAdjust({ actorId: ADMIN, userId: USER, amount: 100, reason: "Tournoi" });
    await adminAdjust({ actorId: ADMIN, userId: USER, amount: -40, reason: "Correction" });
    expect(await getBalance(USER)).toBe(60);

    await expect(
      adminAdjust({ actorId: ADMIN, userId: USER, amount: -61, reason: "Correction" }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await listNotifications(USER)).toHaveLength(2);
  });

  it("une double soumission n'applique et ne notifie qu'une fois", async () => {
    const input = {
      actorId: ADMIN,
      userId: USER,
      amount: 200,
      reason: "Tournoi",
      idempotencyKey: key(),
    };
    const first = await adminAdjust(input);
    expect(await adminAdjust(input)).toEqual(first);
    expect(await getBalance(USER)).toBe(200);
    expect(await listNotifications(USER)).toHaveLength(1);
  });

  it("exige un motif", async () => {
    await expect(
      adminAdjust({ actorId: ADMIN, userId: USER, amount: 10, reason: "  " }),
    ).rejects.toThrow();
  });

  it("refuse un acteur non admin", async () => {
    await expect(
      adminAdjust({ actorId: USER, userId: USER, amount: 10, reason: "Triche" }),
    ).rejects.toThrow("Réservé aux admins.");
    expect(await getBalance(USER)).toBe(0);
  });
});

describe("getBalances", () => {
  it("renvoie 0 pour les membres sans wallet", async () => {
    await credit({ userId: USER, amount: 7, reason: "Gain", idempotencyKey: key() });
    const balances = await getBalances([USER, OTHER]);
    expect(Object.fromEntries(balances)).toEqual({ [USER]: 7, [OTHER]: 0 });
  });
});
