import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, withTx } from "../src/index";
import { truncateTestDb } from "../src/testing";

beforeEach(truncateTestDb);
afterAll(() => db.$disconnect());

describe("@app/db", () => {
  it("se connecte et exécute SELECT 1", async () => {
    const rows = await db.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it("crée les schémas de domaine", async () => {
    const rows = await db.$queryRaw<{ nspname: string }[]>`
      SELECT nspname FROM pg_namespace WHERE nspname IN ('core', 'economy', 'ideas') ORDER BY nspname`;
    expect(rows.map((r) => r.nspname)).toEqual(["core", "economy", "ideas"]);
  });

  it("withTx réutilise la transaction fournie au lieu d'en ouvrir une", async () => {
    await db.$transaction(async (outer) => {
      const inner = await withTx(async (tx) => tx, { tx: outer });
      expect(inner).toBe(outer);
      const [a] = await outer.$queryRaw<{ id: bigint }[]>`SELECT txid_current() AS id`;
      const [b] = await withTx(
        (tx) => tx.$queryRaw<{ id: bigint }[]>`SELECT txid_current() AS id`,
        {
          tx: outer,
        },
      );
      expect(b?.id).toBe(a?.id);
    });
  });
});
