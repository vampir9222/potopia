import { db, withTx } from "@app/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  controlEdition,
  getMemberSnapshot,
  getPresentationSnapshot,
  listOwnChoices,
  setChoice,
  setEditionMembers,
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
async function finishRound(roundId: string) {
  await f.control({ action: "announce", roundId });
  await f.control({ action: "lock", roundId });
  while (true) {
    const round = (await getMemberSnapshot(f.access())).rounds.find((r) => r.id === roundId);
    if (!round || round.revealedCount === round.eligibleCount) break;
    await f.control({ action: "reveal", roundId });
  }
  await f.control({ action: "recap", roundId });
}
const predict = (actorId: string, targetId = U, gameId?: string) =>
  setPrediction({
    ...f.access(actorId),
    roundId: f.first,
    targetId,
    gameId: gameId ?? f.gameId("Jeu U1"),
  });

describe("Snapshots membres et TV", () => {
  it("protège les choix des autres pour tous les rôles et ne donne aucune réponse personnelle à la TV", async () => {
    await predict(O);
    for (const actorId of [A, O, P, U]) {
      const member = await getMemberSnapshot(f.access(actorId));
      expect(member.choices.every((c) => c.userId === actorId)).toBe(true);
      expect(member.predictions.every((p) => p.userId === actorId)).toBe(true);
      expect(member.members.find((m) => m.id === U)).toMatchObject({
        gameCount: 2,
        choiceCount: 2,
      });
      expect(member.rounds.every((r) => r.eligibleUsers === null && r.eligibleCount === null)).toBe(
        true,
      );
      expect(member.standings === null).toBe(actorId === U || actorId === O);
      const tv = await getPresentationSnapshot(f.access(actorId));
      expect(tv.choices).toEqual([]);
      expect(tv.predictions).toEqual([]);
      expect(tv.games).toEqual([]);
      expect(tv.standings).toBeNull();
      const text = JSON.stringify(tv);
      for (const forbidden of [
        "SECRET_",
        "email",
        "discordId",
        "gameCount",
        "choiceCount",
        "eligibleUsers",
        "eligibleCount",
        "organizer",
        "revealOrder",
        "proposals",
        "permissions",
      ])
        expect(text).not.toContain(forbidden === "SECRET_" ? forbidden : `"${forbidden}":`);
    }
    await expect(getMemberSnapshot(f.access(X))).rejects.toMatchObject({ status: 403 });
    await expect(getPresentationSnapshot(f.access(X))).rejects.toMatchObject({ status: 403 });
  });

  it("ne publie que le préfixe révélé et les pronostics correspondants", async () => {
    await predict(O, U);
    await predict(U, P, f.gameId("Jeu P1"));
    await f.control({ action: "announce", roundId: f.first });
    await f.control({ action: "lock", roundId: f.first });
    await f.control({ action: "reveal", roundId: f.first });
    const stored = await db.gotyRound.findUniqueOrThrow({ where: { id: f.first } });
    const revealedId = stored.revealOrder[0];
    const hiddenId = stored.revealOrder[1];
    const tv = await getPresentationSnapshot(f.access(hiddenId));
    expect(tv.rounds[0]?.revealedUsers).toEqual([revealedId]);
    expect(tv.choices.map((c) => c.userId)).toEqual([revealedId]);
    expect(tv.predictions.every((p) => p.targetId === revealedId)).toBe(true);
    expect(tv.games).toHaveLength(1);
    expect(JSON.stringify(tv)).not.toContain(hiddenId === U ? "SECRET_U" : "SECRET_P");
    const admin = await getMemberSnapshot(f.access(A));
    expect(admin.choices.map((c) => c.userId)).toEqual([revealedId]);
    expect(admin.predictions.every((p) => p.targetId === revealedId)).toBe(true);
  });

  it("calcule un point par bonne réponse révélée et conserve les ex æquo sans départage", async () => {
    await predict(O);
    await predict(P);
    await predict(U, P, f.gameId("Jeu P2"));
    await finishRound(f.first);
    const member = await getMemberSnapshot(f.access());
    expect(member.standings?.map((s) => [s.id, s.points, s.rank])).toEqual([
      [O, 1, 1],
      [P, 1, 1],
      [U, 0, 3],
    ]);
    expect((await getMemberSnapshot(f.access(U))).standings).toBeNull();
    expect((await getPresentationSnapshot(f.access(A))).standings).toBeNull();
    await f.control({ action: "leaderboard" });
    expect((await getMemberSnapshot(f.access(U))).standings).toEqual(member.standings);
    expect((await getPresentationSnapshot(f.access(U))).standings).toEqual(member.standings);
    // Les choix de la bande-son sont toujours cachés : aucun point supplémentaire.
    expect((await getPresentationSnapshot(f.access())).choices).toHaveLength(2);
  });

  it("filtre les propriétés supplémentaires du JSON et une commande audio encore secrète", async () => {
    await db.gotyEdition.update({
      where: { id: f.editionId },
      data: {
        screen: {
          mode: "waiting",
          roundId: f.music,
          audio: { userId: U, nonce: "nonce-fictif", privateExtra: "SECRET_EXTRA" },
          privateExtra: "SECRET_EXTRA",
        },
      },
    });
    for (const snapshot of [
      await getMemberSnapshot(f.access(U)),
      await getPresentationSnapshot(f.access(U)),
    ]) {
      expect(snapshot.edition.screen.audio).toBeNull();
      expect(JSON.stringify(snapshot.edition.screen)).not.toContain("SECRET_EXTRA");
    }
  });
});

describe("Retour en préparation et archives", () => {
  it("réinitialise les révélations et points sans perdre les choix ou pronostics", async () => {
    await predict(O);
    await finishRound(f.first);
    const choices = await db.gotyChoice.findMany({
      orderBy: [{ roundId: "asc" }, { userId: "asc" }],
    });
    const predictions = await db.gotyPrediction.findMany();
    const before = await getMemberSnapshot(f.access());
    await expect(f.control({ action: "restart", confirmRestart: true }, O)).rejects.toMatchObject({
      status: 403,
    });
    await f.control({ action: "restart", confirmRestart: true });
    const after = await getMemberSnapshot(f.access());
    expect(after.edition).toMatchObject({
      phase: "preparation",
      version: before.edition.version + 1,
      screen: { mode: "waiting", roundId: null, audio: null },
    });
    expect(
      after.rounds.every(
        (r) => r.status === "draft" && r.revealedCount === 0 && r.eligibleCount === null,
      ),
    ).toBe(true);
    expect(after.standings?.every((s) => s.points === 0)).toBe(true);
    expect(
      await db.gotyChoice.findMany({ orderBy: [{ roundId: "asc" }, { userId: "asc" }] }),
    ).toEqual(choices);
    expect(await db.gotyPrediction.findMany()).toEqual(predictions);
    expect((await getPresentationSnapshot(f.access())).choices).toEqual([]);
    expect((await db.gotyRound.findMany()).every((r) => r.revealOrder.length === 0)).toBe(true);
    await setEditionMembers({
      ...f.access(O),
      expectedVersion: after.edition.version,
      members: [
        { userId: O, organizer: true, presenter: false },
        { userId: P, organizer: false, presenter: true },
        { userId: U, organizer: false, presenter: false },
        { userId: X, organizer: false, presenter: false },
      ],
    });
    await setChoice({ ...f.access(U), roundId: f.first, gameId: f.gameId("Jeu U2") });
    expect((await listOwnChoices(f.access(U))).find((c) => c.roundId === f.first)?.gameId).toBe(
      f.gameId("Jeu U2"),
    );
  });

  it("joue une édition complète, accepte une rubrique vide et archive pour tous les membres", async () => {
    await predict(O);
    await predict(U, O, f.gameId("Jeu O1"));
    for (const roundId of [f.first, f.music, f.empty]) await finishRound(roundId);
    await f.control({ action: "close" });
    const archive = await getMemberSnapshot(f.access(X));
    expect(archive.edition).toMatchObject({
      phase: "closed",
      screen: { mode: "leaderboard", roundId: null, audio: null },
    });
    expect(archive.choices).toHaveLength(4);
    expect(archive.predictions).toEqual([expect.objectContaining({ userId: O, targetId: U })]);
    expect((await getMemberSnapshot(f.access(U))).predictions).toHaveLength(2);
    expect(archive.standings?.find((s) => s.id === O)?.points).toBe(1);
    expect(archive.rounds.find((r) => r.id === f.empty)).toMatchObject({
      status: "done",
      revealedCount: 0,
      eligibleCount: 0,
    });
    expect((await getPresentationSnapshot(f.access(X))).games).toHaveLength(4);
    await expect(predict(O)).rejects.toMatchObject({ status: 409 });
    await expect(
      setChoice({ ...f.access(U), roundId: f.first, gameId: null }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(f.control({ action: "restart", confirmRestart: true }, A)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      setRoundOrder({
        ...f.access(A),
        expectedVersion: archive.edition.version,
        roundIds: [f.first, f.music, f.empty],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await getMemberSnapshot(f.access(X))).toEqual(archive);
  });
});

describe("Concurrence sur PostgreSQL", () => {
  it("sérialise la modification d’un choix et son annonce sans perdre le gel", async () => {
    const version = await f.version();
    const [changed, announced] = await Promise.allSettled([
      setChoice({ ...f.access(U), roundId: f.first, gameId: f.gameId("Jeu U2") }),
      f.control({ action: "announce", roundId: f.first }, P, version),
    ]);
    if (announced.status === "rejected") {
      expect(announced.reason).toMatchObject({ status: 409 });
      expect(changed.status).toBe("fulfilled");
      await f.control({ action: "announce", roundId: f.first });
    } else {
      expect(changed.status).toBe("rejected");
    }
    const choice = (await listOwnChoices(f.access(U))).find((c) => c.roundId === f.first);
    expect(choice?.gameId).toBe(f.gameId(changed.status === "fulfilled" ? "Jeu U2" : "Jeu U1"));
    await expect(
      setChoice({ ...f.access(U), roundId: f.first, gameId: null }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("sérialise un pronostic et la fermeture ; aucun vote ne passe après fermeture", async () => {
    await f.control({ action: "announce", roundId: f.first });
    const version = await f.version();
    const [predicted, locked] = await Promise.allSettled([
      predict(O),
      f.control({ action: "lock", roundId: f.first }, P, version),
    ]);
    if (locked.status === "rejected") {
      expect(locked.reason).toMatchObject({ status: 409 });
      expect(predicted.status).toBe("fulfilled");
      await f.control({ action: "lock", roundId: f.first });
    } else {
      expect(predicted.status).toBe("rejected");
      if (predicted.status === "rejected") expect(predicted.reason).toMatchObject({ status: 409 });
    }
    expect(await db.gotyPrediction.count()).toBe(predicted.status === "fulfilled" ? 1 : 0);
    await expect(predict(O)).rejects.toMatchObject({ status: 409 });
    await f.control({ action: "reveal", roundId: f.first });
    await f.control({ action: "reveal", roundId: f.first });
    expect((await getMemberSnapshot(f.access())).standings?.find((s) => s.id === O)?.points).toBe(
      predicted.status === "fulfilled" ? 1 : 0,
    );
  });

  it("ne peut rouvrir et révéler simultanément avec la même version", async () => {
    await f.control({ action: "announce", roundId: f.first });
    await f.control({ action: "lock", roundId: f.first });
    const version = await f.version();
    const results = await Promise.allSettled([
      f.control({ action: "reopen", roundId: f.first }, P, version),
      f.control({ action: "reveal", roundId: f.first }, A, version),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    const round = (await getMemberSnapshot(f.access())).rounds[0];
    expect(
      round?.status === "announced"
        ? round.revealedCount === 0
        : round?.status === "revealing" && round.revealedCount === 1,
    ).toBe(true);
  });

  it("attend une révélation non validée et retourne un snapshot d’une seule version", async () => {
    await predict(O);
    await f.control({ action: "announce", roundId: f.first });
    await f.control({ action: "lock", roundId: f.first });
    const version = await f.version();
    let ready: () => void = () => {};
    let release: () => void = () => {};
    const written = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer = withTx(async (tx) => {
      await controlEdition(
        { ...f.access(), expectedVersion: version, action: "reveal", roundId: f.first },
        { tx },
      );
      ready();
      await gate;
    });
    await written;
    const reader = getPresentationSnapshot(f.access());
    try {
      const deadline = Date.now() + 1500;
      let waiting = false;
      while (Date.now() < deadline) {
        const [row] = await db.$queryRaw<
          { count: number }[]
        >`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR SHARE%'`;
        if (row && row.count > 0) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
    }
    const [, snapshot] = await Promise.all([writer, reader]);
    expect(snapshot.edition.version).toBe(version + 1);
    expect(snapshot.rounds[0]?.revealedCount).toBe(1);
    expect(snapshot.choices).toHaveLength(1);
    expect(snapshot.predictions.every((p) => p.targetId === snapshot.choices[0]?.userId)).toBe(
      true,
    );
  });
});
