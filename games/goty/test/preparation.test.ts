import { db, withTx } from "@app/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCategory,
  addGames,
  deleteGame,
  getEdition,
  listCategories,
  listGames,
  listOwnChoices,
  prepareEdition,
  proposeCategory,
  setChoice,
  setEditionMembers,
  updateGame,
  voteCategory,
} from "../src/index";
import { A, O, P, U, X, openPreparation, setupEdition } from "./fixtures";

let editionId: string;
beforeEach(async () => {
  editionId = await setupEdition();
});
afterEach(() => vi.unstubAllEnvs());
const access = (actorId = U) => ({ actorId, editionId });
async function game(actorId = U, title = "Jeu fictif") {
  await addGames({ ...access(actorId), games: [{ title }] });
  const games = await listGames(access(actorId));
  const created = games.find((g) => g.userId === actorId && g.title === title);
  if (!created) throw new Error("Jeu absent");
  return created.id;
}
async function round(name = "Top 1") {
  const found = (await listCategories(access())).rounds.find((r) => r.name === name);
  if (!found) throw new Error("Rubrique absente");
  return found.id;
}

describe("Préparation des catégories", () => {
  it("n’accorde aucun vote implicite, permet de retirer une voix et exige 75 % de tous les inscrits", async () => {
    const proposal = await proposeCategory({ ...access(), name: "Meilleure exploration" });
    expect((await listCategories(access())).proposals[0]).toMatchObject({ votes: 0, voted: false });
    for (const actorId of [U, O])
      await voteCategory({ ...access(actorId), proposalId: proposal.id, favor: true });
    await voteCategory({ ...access(), proposalId: proposal.id, favor: true });
    expect((await listCategories(access())).proposals[0]).toMatchObject({ votes: 2, voted: true });
    await voteCategory({ ...access(), proposalId: proposal.id, favor: false });
    expect((await listCategories(access())).proposals[0]?.votes).toBe(1);
    await openPreparation(editionId);
    expect((await listCategories(access())).rounds).toHaveLength(14);
    await expect(
      voteCategory({ ...access(), proposalId: proposal.id, favor: true }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("adopte une proposition à trois voix sur trois et ne la recalcule pas après une arrivée", async () => {
    const proposal = await proposeCategory({ ...access(), name: "Prix collectif" });
    for (const actorId of [U, O, P])
      await voteCategory({ ...access(actorId), proposalId: proposal.id, favor: true });
    const prepared = await openPreparation(editionId);
    const before = (await listCategories(access())).rounds;
    expect(before).toHaveLength(15);
    await setEditionMembers({
      ...access(O),
      expectedVersion: prepared.version,
      members: [
        { userId: O, organizer: true, presenter: false },
        { userId: P, organizer: false, presenter: true },
        { userId: U, organizer: false, presenter: false },
        { userId: X, organizer: false, presenter: false },
      ],
    });
    expect((await listCategories(access(X))).rounds).toEqual(before);
  });

  it("refuse les noms équivalents et réserve l’ajout direct à l’organisation en préparation", async () => {
    await expect(
      proposeCategory({ ...access(), name: "  MEILLEURE   BANDE-SON " }),
    ).rejects.toMatchObject({ status: 409 });
    await proposeCategory({ ...access(), name: "Épopée d’un soir" });
    await expect(proposeCategory({ ...access(P), name: "epopee d'un soir" })).rejects.toMatchObject(
      { status: 409 },
    );
    await expect(addCategory({ ...access(O), name: "Prix direct" })).rejects.toMatchObject({
      status: 409,
    });
    await openPreparation(editionId);
    for (const actorId of [P, U, X])
      await expect(addCategory({ ...access(actorId), name: "Prix direct" })).rejects.toMatchObject({
        status: 403,
      });
    await addCategory({ ...access(O), name: "  Prix   direct " });
    expect((await listCategories(access())).rounds.at(-1)).toMatchObject({
      name: "Prix direct",
      position: 14,
      rank: null,
      soundtrack: false,
    });
    await expect(addCategory({ ...access(O), name: "PRIX DIRECT" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("sérialise deux ajouts équivalents sans doublon de position ni de nom", async () => {
    await openPreparation(editionId);
    const results = await Promise.allSettled(
      ["Épopée", "epopee"].map((name) => addCategory({ ...access(O), name })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await listCategories(access())).rounds).toHaveLength(15);
  });

  it("vérifie droits, édition et version pour la préparation et les votes", async () => {
    const proposal = await proposeCategory({ ...access(), name: "Autre prix" });
    for (const actorId of [U, P, X])
      await expect(
        prepareEdition({ ...access(actorId), expectedVersion: proposal.version }),
      ).rejects.toMatchObject({ status: 403 });
    await expect(prepareEdition({ ...access(O), expectedVersion: 1 })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      voteCategory({ ...access(A), proposalId: proposal.id, favor: true }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      voteCategory({ ...access(), proposalId: "autre-edition", favor: true }),
    ).rejects.toMatchObject({ status: 404 });
    await openPreparation(editionId);
    await expect(proposeCategory({ ...access(), name: "Trop tard" })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("Jeux et imports atomiques", () => {
  it("partage les listes mais réserve les écritures au propriétaire inscrit", async () => {
    const gameId = await game();
    expect(await listGames(access(O))).toHaveLength(1);
    await expect(listGames(access(X))).rejects.toMatchObject({ status: 403 });
    for (const actorId of [A, O, P]) {
      await expect(
        updateGame({ ...access(actorId), gameId, game: { title: "Autrui" } }),
      ).rejects.toMatchObject({ status: actorId === A ? 403 : 404 });
      await expect(deleteGame({ ...access(actorId), gameId })).rejects.toMatchObject({
        status: actorId === A ? 403 : 404,
      });
    }
    await updateGame({ ...access(), gameId, game: { title: "Nouveau titre", platinum: true } });
    expect((await listGames(access()))[0]).toMatchObject({
      title: "Nouveau titre",
      platinum: true,
      completed: false,
    });
  });

  it("refuse tout le lot invalide, garde les doublons et permet le rollback composé", async () => {
    await expect(
      addGames({ ...access(), games: [{ title: "Valide" }, { title: " " }] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await listGames(access())).toEqual([]);
    await addGames({ ...access(), games: [{ title: "Doublon" }, { title: "Doublon" }] });
    expect(await listGames(access())).toHaveLength(2);
    await expect(
      withTx(async (tx) => {
        await addGames({ ...access(), games: [{ title: "Annulé" }] }, { tx });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await listGames(access())).toHaveLength(2);
  });

  it.each(["live", "closed"] as const)("fige les listes en phase %s", async (phase) => {
    const gameId = await game();
    await db.gotyEdition.update({ where: { id: editionId }, data: { phase } });
    await expect(addGames({ ...access(), games: [{ title: "Ajout" }] })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      updateGame({ ...access(), gameId, game: { title: "Modifié" } }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(deleteGame({ ...access(), gameId })).rejects.toMatchObject({ status: 409 });
  });

  it("refuse métadonnées invalides et jeux référencés par choix ou pronostic", async () => {
    await expect(
      addGames({
        ...access(),
        games: [{ title: "Test", cover: "https://images.igdb.com.example.test/a" }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      addGames({ ...access(), games: [{ title: "Test", trailerYoutubeId: "invalide" }] }),
    ).rejects.toMatchObject({ status: 400 });
    const gameId = await game();
    await openPreparation(editionId);
    const roundId = await round();
    await setChoice({ ...access(), roundId, gameId });
    await expect(deleteGame({ ...access(), gameId })).rejects.toMatchObject({ status: 409 });
    await setChoice({ ...access(), roundId, gameId: null });
    await db.gotyPrediction.create({ data: { roundId, gameId, userId: O, targetId: U } });
    await expect(deleteGame({ ...access(), gameId })).rejects.toMatchObject({ status: 409 });
    await db.gotyPrediction.deleteMany();
    await deleteGame({ ...access(), gameId });
    expect(await listGames(access())).toHaveLength(0);
  });
});

describe("Concurrence de la préparation", () => {
  it("attend la transition concurrente avant de décider si un import est encore autorisé", async () => {
    let locked: () => void = () => {};
    let release: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const transition = withTx(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "goty"."editions" WHERE id = ${editionId} FOR UPDATE`;
      await tx.gotyEdition.update({
        where: { id: editionId },
        data: { phase: "live", version: { increment: 1 } },
      });
      locked();
      await gate;
    });
    await ready;
    const importing = expect(
      addGames({ ...access(), games: [{ title: "Import pendant annonce" }] }),
    ).rejects.toMatchObject({ status: 409 });
    release();
    await Promise.all([transition, importing]);
    expect(await listGames(access())).toHaveLength(0);
  });
});

describe("Palmarès privés", () => {
  it("ne transmet que ses propres choix et aucune précision via les listes publiques", async () => {
    const gameId = await game();
    const otherGameId = await game(P, "Autre jeu fictif");
    await openPreparation(editionId);
    await setChoice({ ...access(), roundId: await round(), gameId, precision: "PRECISION_PRIVEE" });
    await setChoice({
      ...access(P),
      roundId: await round(),
      gameId: otherGameId,
      precision: "AUTRE_PRECISION_PRIVEE",
    });
    expect(await listOwnChoices(access())).toHaveLength(1);
    expect(await listOwnChoices(access(O))).toEqual([]);
    expect(await listOwnChoices(access(P))).toEqual([
      expect.objectContaining({ userId: P, gameId: otherGameId }),
    ]);
    await expect(listOwnChoices(access(A))).rejects.toMatchObject({ status: 403 });
    await expect(listOwnChoices(access(X))).rejects.toMatchObject({ status: 403 });
    for (const actorId of [A, O, P]) {
      const publicData = [
        await listGames(access(actorId)),
        await listCategories(access(actorId)),
        await getEdition(access(actorId)),
      ];
      expect(JSON.stringify(publicData)).not.toContain("PRECISION_PRIVEE");
      expect(JSON.stringify(publicData)).not.toContain("revealOrder");
    }
  });

  it("permet un top court, refuse le même jeu à deux places et accepte le cumul avec plusieurs prix", async () => {
    const gameId = await game();
    const roundId = await round();
    await expect(setChoice({ ...access(), roundId, gameId })).rejects.toMatchObject({
      status: 409,
    });
    await openPreparation(editionId);
    await setChoice({ ...access(), roundId, gameId });
    await expect(
      setChoice({ ...access(), roundId: await round("Top 2"), gameId }),
    ).rejects.toMatchObject({ status: 409 });
    for (const name of ["Coup de cœur", "Meilleur gameplay"])
      await setChoice({ ...access(), roundId: await round(name), gameId });
    expect(await listOwnChoices(access())).toHaveLength(3);
  });

  it("valide propriétaire, édition et lien de bande-son, puis normalise ce lien", async () => {
    const gameId = await game();
    const otherGame = await game(P);
    await openPreparation(editionId);
    const roundId = await round("Meilleure bande-son");
    await expect(setChoice({ ...access(), roundId, gameId: otherGame })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      setChoice({ ...access(), roundId: "autre-edition", gameId }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      setChoice({
        ...access(),
        roundId: await round(),
        gameId,
        youtube: "https://youtu.be/abcdefghijk",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      setChoice({ ...access(), roundId, gameId, youtube: "https://example.test/abcdefghijk" }),
    ).rejects.toMatchObject({ status: 400 });
    await setChoice({ ...access(), roundId, gameId, youtube: "https://youtu.be/abcdefghijk?t=20" });
    expect((await listOwnChoices(access()))[0]?.youtube).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
  });

  it("fige la rubrique annoncée sans figer les suivantes et conserve les pronostics", async () => {
    const gameId = await game();
    await openPreparation(editionId);
    const roundId = await round();
    await setChoice({ ...access(), roundId, gameId });
    await db.gotyPrediction.create({ data: { roundId, userId: O, targetId: U, gameId } });
    await setChoice({ ...access(), roundId, gameId, precision: "Nouveau choix" });
    expect(await db.gotyPrediction.count()).toBe(1);
    await db.gotyRound.update({ where: { id: roundId }, data: { status: "announced" } });
    await db.gotyEdition.update({ where: { id: editionId }, data: { phase: "live" } });
    await expect(setChoice({ ...access(), roundId, gameId: null })).rejects.toMatchObject({
      status: 409,
    });
    await setChoice({ ...access(), roundId: await round("Coup de cœur"), gameId });
    expect(await listOwnChoices(access())).toHaveLength(2);
  });
});
