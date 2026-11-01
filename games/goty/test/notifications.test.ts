import { listNotifications, listRecentEvents } from "@app/core";
import { db, withTx } from "@app/db";
import { afterEach, expect, it, vi } from "vitest";
import { getEdition, getMemberSnapshot, prepareEdition, setEditionMembers } from "../src/index";
import { A, O, P, U, X, setupEdition } from "./fixtures";
import { setupCeremony } from "./ceremony-fixtures";

afterEach(() => vi.unstubAllEnvs());
const messages = async (userId: string, text: string) =>
  (await listNotifications(userId, 100)).filter((message) => message.title.includes(text));

it("notifie les seuls nouveaux inscrits, pas les changements de rôle ou une liste rejouée", async () => {
  const editionId = await setupEdition();
  for (const id of [O, P, U]) {
    expect(await listNotifications(id)).toMatchObject([
      { title: "GOTY 2150 · Tu participes à cette édition", link: `/goty/${editionId}` },
    ]);
  }
  expect(await listNotifications(A)).toHaveLength(0);
  expect(await listNotifications(X)).toHaveLength(0);
  const members = [
    { userId: O, organizer: true, presenter: true },
    { userId: P, organizer: false, presenter: true },
    { userId: U, organizer: false, presenter: false },
    { userId: X, organizer: false, presenter: false },
  ];
  await setEditionMembers({ actorId: A, editionId, expectedVersion: 2, members });
  await setEditionMembers({ actorId: A, editionId, expectedVersion: 3, members });
  for (const id of [O, P, U, X]) expect(await listNotifications(id)).toHaveLength(1);
});

it("publie une seule ouverture malgré deux commandes concurrentes, sans notifier acteur ou retiré", async () => {
  const editionId = await setupEdition();
  await setEditionMembers({
    actorId: A,
    editionId,
    expectedVersion: 2,
    members: [
      { userId: O, organizer: true, presenter: false },
      { userId: U, organizer: false, presenter: false },
    ],
  });
  const command = { actorId: O, editionId, expectedVersion: 3 };
  const results = await Promise.allSettled([prepareEdition(command), prepareEdition(command)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await messages(U, "préparation des palmarès")).toHaveLength(1);
  for (const id of [O, P, A, X])
    expect(await messages(id, "préparation des palmarès")).toHaveLength(0);
});

it("réserve les messages aux transitions utiles, sans détail secret ni activité publique", async () => {
  const f = await setupCeremony();
  await f.control({ action: "announce", roundId: f.first });
  for (const id of [O, U]) expect(await messages(id, "La soirée commence")).toHaveLength(1);
  expect(await messages(P, "La soirée commence")).toHaveLength(0);
  await f.control({ action: "lock", roundId: f.first });
  await f.control({ action: "reveal", roundId: f.first });
  await f.control({ action: "reveal", roundId: f.first });
  await f.control({ action: "recap", roundId: f.first });
  await f.control({ action: "announce", roundId: f.music });
  expect(await messages(U, "La soirée commence")).toHaveLength(1);
  await f.control({ action: "restart", confirmRestart: true });
  expect(await messages(U, "revenue en préparation")).toHaveLength(1);
  await f.control({ action: "restart", confirmRestart: true });
  expect(await messages(U, "revenue en préparation")).toHaveLength(1);
  for (const roundId of [f.first, f.music, f.empty]) {
    await f.control({ action: "announce", roundId });
    await f.control({ action: "lock", roundId });
    if (roundId !== f.empty) {
      await f.control({ action: "reveal", roundId });
      await f.control({ action: "reveal", roundId });
    }
    await f.control({ action: "recap", roundId });
  }
  const version = await f.version();
  await f.control({ action: "close" });
  await expect(f.control({ action: "close" }, P, version)).rejects.toMatchObject({ status: 409 });
  expect(await messages(U, "archives sont disponibles")).toMatchObject([
    { link: `/goty/${f.editionId}/archives` },
  ]);
  expect(await messages(U, "La soirée commence")).toHaveLength(2);
  for (const id of [A, X]) expect(await listNotifications(id)).toHaveLength(0);
  const all = JSON.stringify(await db.notification.findMany());
  expect(all).not.toMatch(/SECRET_|Jeu U|Jeu P|Coup de cœur|youtu|Pr[ée]paration fictive/);
  expect(await listRecentEvents()).toHaveLength(0);
});

it("annule notifications et transition dans la transaction de l’appelant", async () => {
  const editionId = await setupEdition();
  await expect(
    withTx(async (tx) => {
      await prepareEdition({ actorId: O, editionId, expectedVersion: 2 }, { tx });
      expect(
        await tx.notification.count({ where: { title: { contains: "préparation des palmarès" } } }),
      ).toBe(2);
      throw new Error("rollback fictif");
    }),
  ).rejects.toThrow("rollback fictif");
  expect((await getEdition({ actorId: O, editionId })).edition).toMatchObject({
    phase: "categories",
    version: 2,
  });
  expect(await messages(U, "préparation des palmarès")).toHaveLength(0);
  await expect(prepareEdition({ actorId: U, editionId, expectedVersion: 2 })).rejects.toMatchObject(
    { status: 403 },
  );
  expect(await messages(U, "préparation des palmarès")).toHaveLength(0);
});

it("ignore une identité supprimée et relit les profils du portail sans copie GOTY", async () => {
  const editionId = await setupEdition();
  await db.notification.deleteMany({ where: { userId: P } });
  await db.user.delete({ where: { id: P } });
  await db.user.update({
    where: { id: U },
    data: { name: "Profil fictif actualisé", image: null },
  });
  await prepareEdition({ actorId: O, editionId, expectedVersion: 2 });
  expect(await messages(U, "préparation des palmarès")).toHaveLength(1);
  expect(
    (await getMemberSnapshot({ actorId: O, editionId })).members.find((m) => m.id === U),
  ).toMatchObject({ name: "Profil fictif actualisé", image: null });
});
