import { db, withTx } from "@app/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addGames,
  controlEdition,
  getMemberSnapshot,
  getPresentationSnapshot,
  listOwnChoices,
  setChoice,
  setPrediction,
  setRoundOrder,
} from "../src/index";
import { A, O, P, U, X } from "./fixtures";
import { setupCeremony } from "./ceremony-fixtures";

let f: Awaited<ReturnType<typeof setupCeremony>>;
beforeEach(async () => {
  f = await setupCeremony();
});
afterEach(() => vi.unstubAllEnvs());
const prediction = (actorId = O, targetId = U, gameId?: string | null, roundId?: string) =>
  setPrediction({
    ...f.access(actorId),
    roundId: roundId ?? f.first,
    targetId,
    gameId: gameId === undefined ? f.gameId("Jeu U1") : gameId,
  });
async function announceAndLock() {
  await f.control({ action: "announce", roundId: f.first });
  await f.control({ action: "lock", roundId: f.first });
}

describe("Pronostics", () => {
  it("ouvre avant le choix personnel, remplace et efface sans toucher au palmarès", async () => {
    await prediction(U, O, f.gameId("Jeu O1"));
    expect((await getMemberSnapshot(f.access(U))).predictions).toHaveLength(1);
    await prediction(U, O, null);
    expect((await getMemberSnapshot(f.access(U))).predictions).toEqual([]);
    await prediction();
    await prediction(O, U, f.gameId("Jeu U2"));
    expect((await getMemberSnapshot(f.access(O))).predictions).toEqual([
      expect.objectContaining({ gameId: f.gameId("Jeu U2") }),
    ]);
    expect(await listOwnChoices(f.access(U))).toHaveLength(2);
  });

  it("contrôle auteur, cible, propriétaire du jeu et édition de la rubrique", async () => {
    for (const actorId of [A, X])
      await expect(prediction(actorId)).rejects.toMatchObject({ status: 403 });
    await expect(prediction(U, U)).rejects.toMatchObject({ status: 403 });
    await expect(prediction(O, X)).rejects.toMatchObject({ status: 400 });
    await expect(prediction(O, U, f.gameId("Jeu P1"))).rejects.toMatchObject({ status: 400 });
    await expect(prediction(O, U, f.gameId("Jeu U1"), "autre-rubrique")).rejects.toMatchObject({
      status: 404,
    });
    expect(await db.gotyPrediction.count()).toBe(0);
  });

  it("ferme en catégories et après clôture sans modifier les données", async () => {
    for (const phase of ["categories", "closed"] as const) {
      await db.gotyEdition.update({ where: { id: f.editionId }, data: { phase } });
      await expect(prediction()).rejects.toMatchObject({ status: 409 });
    }
    expect(await db.gotyPrediction.count()).toBe(0);
  });

  it("neutralise les cibles sans choix, garde les rubriques futures ouvertes et ferme la courante", async () => {
    await prediction(U, O, f.gameId("Jeu O1"));
    await f.control({ action: "announce", roundId: f.first });
    await expect(prediction(U, O, null)).rejects.toMatchObject({ status: 409 });
    await prediction();
    await f.control({ action: "lock", roundId: f.first });
    await expect(prediction()).rejects.toMatchObject({ status: 409 });
    await expect(prediction(O, U, null)).rejects.toMatchObject({ status: 409 });
    await prediction(O, U, f.gameId("Jeu U2"), f.music);
    expect(await db.gotyPrediction.count()).toBe(3);
  });
});

describe("Pilotage de la cérémonie", () => {
  it("réserve les commandes aux présentateurs et admins, avec validation des arguments", async () => {
    const version = await f.version();
    for (const actorId of [O, U, X])
      await expect(
        f.control({ action: "announce", roundId: f.first }, actorId),
      ).rejects.toMatchObject({ status: 403 });
    for (const invalid of [
      { action: "inconnue" },
      { action: "announce" },
      { action: "play" },
      { action: "restart" },
      { action: "restart", confirmRestart: false },
    ])
      await expect(
        Reflect.apply(controlEdition, undefined, [
          { ...f.access(), expectedVersion: version, ...invalid },
        ]),
      ).rejects.toMatchObject({ status: 400 });
    expect(await f.version()).toBe(version);
    await f.control({ action: "announce", roundId: f.first }, A);
    expect((await getMemberSnapshot(f.access(A))).permissions.participate).toBe(false);
  });

  it("refuse les étapes invalides, l’ordre prématuré et la clôture incomplète", async () => {
    const before = await getPresentationSnapshot(f.access());
    for (const action of ["lock", "reopen", "reveal", "recap"] as const)
      await expect(f.control({ action, roundId: f.first })).rejects.toMatchObject({ status: 409 });
    await expect(f.control({ action: "announce", roundId: f.music })).rejects.toMatchObject({
      status: 409,
    });
    await expect(f.control({ action: "announce", roundId: "autre-edition" })).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(f.control({ action: "close" })).rejects.toMatchObject({ status: 409 });
    expect(await getPresentationSnapshot(f.access())).toEqual(before);
    await f.control({ action: "announce", roundId: f.first });
    await expect(f.control({ action: "announce", roundId: f.music })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      addGames({ ...f.access(U), games: [{ title: "Après lancement" }] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      setChoice({ ...f.access(U), roundId: f.first, gameId: null }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("annonce les seuls participants ayant un choix, sans exposer leur ordre futur", async () => {
    const result = await f.control({ action: "announce", roundId: f.first });
    expect(Object.keys(result).sort()).toEqual(["ok", "version"]);
    const member = await getMemberSnapshot(f.access(U));
    expect(member.edition.phase).toBe("live");
    expect(member.rounds[0]).toMatchObject({
      status: "announced",
      eligibleCount: 2,
      eligibleUsers: [P, U].sort(),
      revealedUsers: [],
      revealedCount: 0,
    });
    expect(JSON.stringify(member)).not.toContain("revealOrder");
    const stored = await db.gotyRound.findUniqueOrThrow({ where: { id: f.first } });
    expect([...stored.revealOrder].sort()).toEqual([P, U].sort());
  });

  it("rouvre uniquement avant la première révélation et révèle un choix par commande", async () => {
    await announceAndLock();
    await f.control({ action: "reopen", roundId: f.first });
    await prediction();
    await f.control({ action: "lock", roundId: f.first });
    await f.control({ action: "reveal", roundId: f.first });
    expect((await getPresentationSnapshot(f.access())).choices).toHaveLength(1);
    await expect(f.control({ action: "reopen", roundId: f.first })).rejects.toMatchObject({
      status: 409,
    });
    await expect(f.control({ action: "recap", roundId: f.first })).rejects.toMatchObject({
      status: 409,
    });
    await f.control({ action: "reveal", roundId: f.first });
    expect((await getPresentationSnapshot(f.access())).choices).toHaveLength(2);
    await expect(f.control({ action: "reveal", roundId: f.first })).rejects.toMatchObject({
      status: 409,
    });
    await f.control({ action: "recap", roundId: f.first });
    expect((await getPresentationSnapshot(f.access())).edition.screen.mode).toBe("recap");
  });

  it("protège une révélation contre deux commandes simultanées et leur rejeu", async () => {
    await announceAndLock();
    const version = await f.version();
    const results = await Promise.allSettled(
      [1, 2].map(() => f.control({ action: "reveal", roundId: f.first }, P, version)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    const snapshot = await getPresentationSnapshot(f.access());
    expect(snapshot.choices).toHaveLength(1);
    expect(snapshot.edition.version).toBe(version + 1);
    await expect(
      f.control({ action: "reveal", roundId: f.first }, P, version),
    ).rejects.toMatchObject({ status: 409 });
    expect(await getPresentationSnapshot(f.access())).toEqual(snapshot);
  });

  it("exige un top contigu à chaque annonce de place et autorise un top court", async () => {
    const top2 = await db.gotyRound.create({
      data: {
        editionId: f.editionId,
        name: "Top 2",
        normalizedName: "top 2",
        rank: 2,
        position: 3,
      },
    });
    await setChoice({ ...f.access(U), roundId: top2.id, gameId: f.gameId("Jeu U2") });
    await setRoundOrder({
      ...f.access(O),
      expectedVersion: await f.version(),
      roundIds: [top2.id, f.first, f.music, f.empty],
    });
    await expect(f.control({ action: "announce", roundId: top2.id })).rejects.toMatchObject({
      status: 409,
    });
    const top1 = await db.gotyRound.create({
      data: {
        editionId: f.editionId,
        name: "Top 1",
        normalizedName: "top 1",
        rank: 1,
        position: 4,
      },
    });
    await setChoice({ ...f.access(U), roundId: top1.id, gameId: f.gameId("Jeu U1") });
    await f.control({ action: "announce", roundId: top2.id });
    expect((await getMemberSnapshot(f.access())).rounds[0]?.eligibleUsers).toEqual([U]);
  });

  it("revient au bon écran après deux demandes de classement", async () => {
    await announceAndLock();
    await f.control({ action: "reveal", roundId: f.first });
    const before = await getPresentationSnapshot(f.access());
    await f.control({ action: "leaderboard" });
    await f.control({ action: "leaderboard" });
    expect((await getPresentationSnapshot(f.access())).standings).not.toBeNull();
    await f.control({ action: "resume" });
    const after = await getPresentationSnapshot(f.access());
    expect(after.edition.screen).toEqual(before.edition.screen);
    expect(after.choices).toEqual(before.choices);
    expect(after.standings).toBeNull();
    await expect(f.control({ action: "resume" })).rejects.toMatchObject({ status: 409 });
  });

  it("compose commandes et transaction puis annule versions, écrans et révélations", async () => {
    const before = await getPresentationSnapshot(f.access());
    await expect(
      withTx(async (tx) => {
        const announced = await controlEdition(
          {
            ...f.access(),
            expectedVersion: before.edition.version,
            action: "announce",
            roundId: f.first,
          },
          { tx },
        );
        await controlEdition(
          { ...f.access(), expectedVersion: announced.version, action: "lock", roundId: f.first },
          { tx },
        );
        throw new Error("Annulation volontaire");
      }),
    ).rejects.toThrow("Annulation volontaire");
    expect(await getPresentationSnapshot(f.access())).toEqual(before);
  });
});

describe("Conducteur et audio", () => {
  it("ne démarre aucun lecteur pour une bande-son sans lien", async () => {
    await setChoice({ ...f.access(P), roundId: f.music, gameId: f.gameId("Jeu P2") });
    await setRoundOrder({
      ...f.access(),
      expectedVersion: await f.version(),
      roundIds: [f.music, f.first, f.empty],
    });
    await f.control({ action: "announce", roundId: f.music });
    await f.control({ action: "lock", roundId: f.music });
    for (let index = 0; index < 2; index++) {
      await f.control({ action: "reveal", roundId: f.music });
      const snapshot = await getPresentationSnapshot(f.access());
      const revealedId = snapshot.rounds[0]?.revealedUsers.at(-1);
      expect(snapshot.edition.screen.audio?.userId ?? null).toBe(revealedId === U ? U : null);
    }
    await expect(f.control({ action: "play", targetId: P })).rejects.toMatchObject({ status: 400 });
  });
  it("échange les positions sans collision et conserve les rubriques commencées", async () => {
    await setRoundOrder({
      ...f.access(O),
      expectedVersion: await f.version(),
      roundIds: [f.music, f.first, f.empty],
    });
    await f.control({ action: "announce", roundId: f.music });
    await expect(
      setRoundOrder({
        ...f.access(),
        expectedVersion: await f.version(),
        roundIds: [f.first, f.music, f.empty],
      }),
    ).rejects.toMatchObject({ status: 409 });
    await setRoundOrder({
      ...f.access(),
      expectedVersion: await f.version(),
      roundIds: [f.music, f.empty, f.first],
    });
    expect((await getMemberSnapshot(f.access())).rounds.map((r) => r.id)).toEqual([
      f.music,
      f.empty,
      f.first,
    ]);
  });

  it("valide les droits, permutations et versions du conducteur", async () => {
    const version = await f.version();
    await expect(
      setRoundOrder({
        ...f.access(U),
        expectedVersion: version,
        roundIds: [f.first, f.music, f.empty],
      }),
    ).rejects.toMatchObject({ status: 403 });
    for (const roundIds of [[f.first], [f.first, f.first, f.empty], [f.first, f.music, "inconnu"]])
      await expect(
        setRoundOrder({ ...f.access(), expectedVersion: version, roundIds }),
      ).rejects.toMatchObject({ status: 400 });
    await setRoundOrder({
      ...f.access(A),
      expectedVersion: version,
      roundIds: [f.first, f.empty, f.music],
    });
    await expect(
      setRoundOrder({
        ...f.access(),
        expectedVersion: version,
        roundIds: [f.first, f.music, f.empty],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("ne joue que les bandes-son révélées et conserve le nonce à la reconnexion", async () => {
    await setRoundOrder({
      ...f.access(),
      expectedVersion: await f.version(),
      roundIds: [f.music, f.first, f.empty],
    });
    await f.control({ action: "announce", roundId: f.music });
    await expect(f.control({ action: "play", targetId: U })).rejects.toMatchObject({ status: 409 });
    await f.control({ action: "lock", roundId: f.music });
    await f.control({ action: "reveal", roundId: f.music });
    const first = await getPresentationSnapshot(f.access());
    const audio = first.edition.screen.audio;
    expect(audio).not.toBeNull();
    if (!audio) throw new Error("Audio absent");
    expect((await getPresentationSnapshot(f.access())).edition.screen.audio).toEqual(audio);
    await f.control({ action: "play", targetId: audio.userId });
    expect((await getPresentationSnapshot(f.access())).edition.screen.audio?.nonce).not.toBe(
      audio.nonce,
    );
    await f.control({ action: "stop" });
    expect((await getPresentationSnapshot(f.access())).edition.screen.audio).toBeNull();
    await f.control({ action: "reveal", roundId: f.music });
    expect((await getPresentationSnapshot(f.access())).edition.screen.audio?.userId).not.toBe(
      audio.userId,
    );
    await f.control({ action: "leaderboard" });
    expect((await getPresentationSnapshot(f.access())).edition.screen.audio).toBeNull();
    await expect(f.control({ action: "play", targetId: audio.userId })).rejects.toMatchObject({
      status: 409,
    });
    await f.control({ action: "resume" });
    await f.control({ action: "recap", roundId: f.music });
    expect((await getPresentationSnapshot(f.access())).edition.screen.audio).toBeNull();
    await f.control({ action: "play", targetId: audio.userId });
    await f.control({ action: "announce", roundId: f.first });
    expect((await getPresentationSnapshot(f.access())).edition.screen.audio).toBeNull();
  });
});
