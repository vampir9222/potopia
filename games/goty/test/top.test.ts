import { db, withTx } from "@app/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addGames,
  listCategories,
  listGames,
  listOwnChoices,
  setChoice,
  setTopOrder,
} from "../src/index";
import { O, U, openPreparation, setupEdition } from "./fixtures";
let editionId: string;
let ids: string[];
beforeEach(async () => {
  editionId = await setupEdition();
  await addGames({
    actorId: U,
    editionId,
    games: [{ title: "Un" }, { title: "Deux" }, { title: "Trois" }],
  });
  ids = (await listGames({ actorId: U, editionId })).map((game) => game.id);
  await openPreparation(editionId);
});
afterEach(() => vi.unstubAllEnvs());
describe("Réordonnancement du top depuis l’interface", () => {
  it("échange deux jeux atomiquement et conserve la précision attachée au jeu", async () => {
    const first = ids[0],
      second = ids[1];
    if (!first || !second) throw new Error("Fixture incomplète");
    const rounds = (await listCategories({ actorId: U, editionId })).rounds.filter(
      (r) => r.rank !== null,
    );
    const top1 = rounds.find((r) => r.rank === 1);
    if (!top1) throw new Error("Top absent");
    await setChoice({
      actorId: U,
      editionId,
      roundId: top1.id,
      gameId: first,
      precision: "Souvenir",
    });
    await setTopOrder({ actorId: U, editionId, gameIds: [first, second] });
    await setTopOrder({ actorId: U, editionId, gameIds: [second, first] });
    const own = await listOwnChoices({ actorId: U, editionId });
    expect(own.find((c) => c.roundId === top1.id)?.gameId).toBe(second);
    expect(own.find((c) => c.gameId === first)?.precision).toBe("Souvenir");
  });
  it("refuse doublons, jeu d’autrui et changement d’une place annoncée sans supprimer le top", async () => {
    await setTopOrder({ actorId: U, editionId, gameIds: ids });
    const before = await listOwnChoices({ actorId: U, editionId });
    await expect(
      setTopOrder({ actorId: U, editionId, gameIds: [ids[0] ?? "", ids[0] ?? ""] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(setTopOrder({ actorId: O, editionId, gameIds: ids })).rejects.toMatchObject({
      status: 400,
    });
    const rank1 = await db.gotyRound.findFirstOrThrow({ where: { editionId, rank: 1 } });
    await db.gotyRound.update({ where: { id: rank1.id }, data: { status: "announced" } });
    await expect(
      setTopOrder({ actorId: U, editionId, gameIds: [...ids].reverse() }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await listOwnChoices({ actorId: U, editionId })).toEqual(before);
  });
  it("annule l’ensemble du déplacement avec la transaction de l’appelant", async () => {
    await setTopOrder({ actorId: U, editionId, gameIds: ids });
    const before = await listOwnChoices({ actorId: U, editionId });
    await expect(
      withTx(async (tx) => {
        await setTopOrder({ actorId: U, editionId, gameIds: [] }, { tx });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await listOwnChoices({ actorId: U, editionId })).toEqual(before);
  });
});
