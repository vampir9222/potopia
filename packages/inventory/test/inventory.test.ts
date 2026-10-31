import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { collectItem, EMERALDS, hasAllEmeralds, listItems, UnknownItemError } from "../src/index";

const ME = "user-me";
const OTHER = "user-other";

beforeEach(async () => {
  await truncateTestDb();
});

describe("inventaire", () => {
  it("ramasse une émeraude une seule fois", async () => {
    const first = await collectItem({ userId: ME, itemId: "emerald-red" });
    expect(first).toEqual({ isNew: true, items: ["emerald-red"], emeralds: 1 });
    const again = await collectItem({ userId: ME, itemId: "emerald-red" });
    expect(again).toMatchObject({ isNew: false, emeralds: 1 });
    expect(await db.inventoryItem.count()).toBe(1);
  });

  it("deux ramassages simultanés : un seul est nouveau", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => collectItem({ userId: ME, itemId: "emerald-blue" })),
    );
    expect(results.filter((r) => r.isNew)).toHaveLength(1);
    expect(await listItems(ME)).toEqual(["emerald-blue"]);
  });

  it("refuse un objet hors catalogue", async () => {
    await expect(collectItem({ userId: ME, itemId: "emerald-black" })).rejects.toBeInstanceOf(
      UnknownItemError,
    );
    await expect(collectItem({ userId: ME, itemId: 42 })).rejects.toBeInstanceOf(UnknownItemError);
    expect(await db.inventoryItem.count()).toBe(0);
  });

  it("chacun son inventaire ; les 7 émeraudes débloquent Super Sonic", async () => {
    for (const e of EMERALDS) await collectItem({ userId: ME, itemId: e.id });
    await collectItem({ userId: OTHER, itemId: "emerald-green" });
    const mine = await listItems(ME);
    expect(mine).toHaveLength(7);
    expect(hasAllEmeralds(mine)).toBe(true);
    expect(hasAllEmeralds(await listItems(OTHER))).toBe(false);
  });
});
