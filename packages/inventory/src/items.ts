import { db, type DbTx } from "@app/db";
import { z } from "zod";
import { countEmeralds, ITEM_IDS } from "./catalog";

/** Objet absent du catalogue. */
export class UnknownItemError extends Error {
  readonly status = 400;
  constructor() {
    super("Objet inconnu");
  }
}

const collectInput = z.object({ userId: z.string().min(1), itemId: z.string() });

/** Les objets trouvés par un membre, du plus ancien au plus récent. */
export async function listItems(userId: string, opts?: { tx?: DbTx }): Promise<string[]> {
  const rows = await (opts?.tx ?? db).inventoryItem.findMany({
    where: { userId },
    orderBy: { foundAt: "asc" },
    select: { itemId: true },
  });
  return rows.map((r) => r.itemId);
}

/**
 * Ramasse un objet du catalogue. Le ramasser deux fois ne fait rien (`isNew` à false), y compris
 * avec deux requêtes simultanées (clé unique membre + objet).
 */
export async function collectItem(
  input: { userId: string; itemId: unknown },
  opts?: { tx?: DbTx },
): Promise<{ isNew: boolean; items: string[]; emeralds: number }> {
  const parsed = collectInput.safeParse(input);
  if (!parsed.success || !ITEM_IDS.includes(parsed.data.itemId)) throw new UnknownItemError();
  const { userId, itemId } = parsed.data;
  const client = opts?.tx ?? db;
  const { count } = await client.inventoryItem.createMany({
    data: [{ userId, itemId }],
    skipDuplicates: true,
  });
  const items = await listItems(userId, opts);
  return { isNew: count === 1, items, emeralds: countEmeralds(items) };
}
