import { createFakeMember } from "@app/core/testing";
import { db, withTx } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEdition,
  getEdition,
  listEditions,
  listEditionMembers,
  listEligibleMembers,
  setEditionMembers,
} from "../src/index";

const ADMIN_DISCORD = "123456789012345678";
const A = "goty-admin";
const O = "goty-organizer";
const P = "goty-presenter";
const U = "goty-participant";
const X = "goty-outsider";
const members = [
  { userId: O, organizer: true, presenter: false },
  { userId: P, organizer: false, presenter: true },
  { userId: U, organizer: false, presenter: false },
];
let editionId: string;

beforeEach(async () => {
  vi.stubEnv("ADMIN_DISCORD_IDS", ADMIN_DISCORD);
  await truncateTestDb();
  for (const [index, userId] of [A, O, P, U, X].entries()) {
    await createFakeMember({
      id: userId,
      discordId: index === 0 ? ADMIN_DISCORD : `99999999999999999${index}`,
      name: `Joueur fictif ${index}`,
    });
  }
  const created = await createEdition({ actorId: A, year: 2150, name: "Édition fictive" });
  editionId = created.id;
  await setEditionMembers({ actorId: A, editionId, expectedVersion: 1, members });
});
afterEach(() => vi.unstubAllEnvs());

const access = (actorId = O) => ({ actorId, editionId });
const change = (actorId = O, next = members, expectedVersion = 2) =>
  setEditionMembers({ ...access(actorId), expectedVersion, members: next });

describe("Socle des éditions GOTY sur PostgreSQL", () => {
  it("crée une édition, son conducteur et son auteur inscrit, sans importer de données", async () => {
    const created = await createEdition({ actorId: O, year: 2151, name: "  Prochaine édition  " });
    const view = await getEdition({ actorId: O, editionId: created.id });
    expect(view).toMatchObject({
      edition: { name: "Prochaine édition", phase: "categories", version: 1 },
      permissions: { organize: true, present: true, participate: true },
    });
    expect(await db.gotyRound.count({ where: { editionId: created.id } })).toBe(14);
    expect(await db.gotyGame.count()).toBe(0);
    expect(await db.gotyChoice.count()).toBe(0);
    expect(await db.gotyPrediction.count()).toBe(0);
    expect(await listEditionMembers({ actorId: O, editionId: created.id })).toHaveLength(1);
  });

  it("refuse création sans droit et entrées invalides sans écrire", async () => {
    await expect(createEdition({ actorId: U, year: 2151, name: "Interdit" })).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(
      createEdition({ actorId: "absent", year: 2151, name: "Interdit" }),
    ).rejects.toMatchObject({ status: 403 });
    for (const input of [
      { year: 1999, name: "Test" },
      { year: 2151, name: " " },
    ]) {
      await expect(createEdition({ actorId: A, ...input })).rejects.toMatchObject({ status: 400 });
    }
    expect(await db.gotyEdition.count()).toBe(1);
  });

  it("sérialise deux créations d’une même année sans conducteur orphelin", async () => {
    const results = await Promise.allSettled(
      [1, 2].map(() => createEdition({ actorId: A, year: 2151, name: "Même année" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await db.gotyEdition.count()).toBe(2);
    expect(await db.gotyRound.count()).toBe(28);
  });

  it("compose les écritures avec une transaction et respecte son rollback", async () => {
    await expect(
      withTx(async (tx) => {
        const created = await createEdition({ actorId: A, year: 2151, name: "Annulée" }, { tx });
        await setEditionMembers(
          { actorId: A, editionId: created.id, expectedVersion: 1, members },
          { tx },
        );
        expect((await listEditions(O, { tx })).some((e) => e.id === created.id)).toBe(true);
        throw new Error("Annulation volontaire");
      }),
    ).rejects.toThrow("Annulation volontaire");
    expect(await db.gotyEdition.count()).toBe(1);
    expect(await db.gotyRound.count()).toBe(14);
  });

  it("ne transmet ni écran brut, ni réponse secrète, ni données de compte", async () => {
    await db.gotyEdition.update({
      where: { id: editionId },
      data: { screen: { privateTest: "SECRET" } },
    });
    for (const actorId of [A, O, P, U]) {
      const view = await getEdition(access(actorId));
      expect(Object.keys(view.edition).sort()).toEqual(["id", "name", "phase", "version", "year"]);
      expect(JSON.stringify(view)).not.toContain("SECRET");
      const identities = await listEditionMembers(access(actorId));
      expect(Object.keys(identities[0] ?? {}).sort()).toEqual([
        "id",
        "image",
        "name",
        "organizer",
        "presenter",
      ]);
    }
  });

  it("filtre les éditions actives et ouvre les archives à tous les membres", async () => {
    expect(await listEditions(X)).toEqual([]);
    expect(await listEditions(A)).toHaveLength(1);
    expect(await listEditions(O)).toHaveLength(1);
    await expect(getEdition(access(X))).rejects.toMatchObject({ status: 403 });
    await expect(listEditionMembers(access(X))).rejects.toMatchObject({ status: 403 });
    await db.gotyEdition.update({ where: { id: editionId }, data: { phase: "closed" } });
    expect(await listEditions(X)).toHaveLength(1);
    expect(await getEdition(access(X))).toMatchObject({
      permissions: { organize: false, present: false, participate: false },
    });
    await expect(getEdition({ actorId: A, editionId: "absent" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("relit les droits admin et ne fait pas confiance au rôle stocké", async () => {
    await db.user.update({ where: { id: X }, data: { role: "admin" } });
    await expect(getEdition(access(X))).rejects.toMatchObject({ status: 403 });
    vi.stubEnv("ADMIN_DISCORD_IDS", "");
    await expect(getEdition(access(A))).rejects.toMatchObject({ status: 403 });
  });

  it("réserve le sélecteur de membres à l’organisation et filtre ses champs", async () => {
    for (const actorId of [P, U, X])
      await expect(listEligibleMembers(access(actorId))).rejects.toMatchObject({ status: 403 });
    const eligible = await listEligibleMembers(access(O));
    expect(eligible).toHaveLength(5);
    expect(Object.keys(eligible[0] ?? {}).sort()).toEqual(["id", "image", "name"]);
  });

  it("permet à l’organisateur de désigner un présentateur, sans changer les organisateurs", async () => {
    await change(
      O,
      members.map((m) => ({ ...m, presenter: m.userId === U })),
    );
    expect(await getEdition(access(U))).toMatchObject({
      permissions: { present: true, organize: false },
    });
    await expect(
      change(
        O,
        members.map((m) => ({ ...m, organizer: true })),
        3,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      change(
        O,
        members.filter((m) => m.userId !== O),
        3,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(change(P, members, 3)).rejects.toMatchObject({ status: 403 });
    await change(
      A,
      members.map((m) => ({ ...m, organizer: m.userId === U })),
      3,
    );
    expect(await getEdition(access(U))).toMatchObject({ permissions: { organize: true } });
  });

  it.each(["categories", "preparation", "live", "closed"] as const)(
    "limite inscriptions et rôles en phase %s",
    async (phase) => {
      await db.gotyEdition.update({ where: { id: editionId }, data: { phase } });
      const added = [...members, { userId: X, organizer: false, presenter: false }];
      if (phase === "categories" || phase === "preparation") {
        await change(O, added);
        expect(await db.gotyMember.count({ where: { editionId } })).toBe(4);
      } else {
        await expect(change(O, added)).rejects.toMatchObject({ status: 409 });
      }
      const currentVersion = (await getEdition(access())).edition.version;
      if (phase === "categories") await change(O, members, currentVersion);
      else
        await expect(
          change(
            O,
            members.filter((m) => m.userId !== U),
            currentVersion,
          ),
        ).rejects.toMatchObject({ status: 409 });
      const version = (await getEdition(access())).edition.version;
      const roles = members.map((m) => ({ ...m, presenter: true }));
      // En préparation, conserver le membre ajouté précédemment.
      if (phase === "preparation") roles.push({ userId: X, organizer: false, presenter: false });
      if (phase === "closed")
        await expect(change(A, roles, version)).rejects.toMatchObject({ status: 409 });
      else await change(A, roles, version);
    },
  );

  it("refuse le retrait d’une personne avec des jeux sans toucher aux rôles", async () => {
    await db.gotyGame.create({ data: { editionId, userId: U, title: "Jeu fictif" } });
    await expect(
      change(
        O,
        members.filter((m) => m.userId !== U),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getEdition(access())).edition.version).toBe(2);
    expect(await db.gotyMember.count({ where: { editionId } })).toBe(3);
  });

  it("nettoie propositions et votes d’un retrait sans toucher aux autres éditions", async () => {
    const proposal = await db.gotyProposal.create({
      data: {
        editionId,
        userId: U,
        name: "Prix fictif",
        normalizedName: "prix fictif",
        votes: { create: [{ userId: O }, { userId: U }] },
      },
    });
    const other = await createEdition({ actorId: A, year: 2151, name: "Autre édition" });
    const otherProposal = await db.gotyProposal.create({
      data: {
        editionId: other.id,
        userId: U,
        name: "Prix fictif",
        normalizedName: "prix fictif",
        votes: { create: { userId: U } },
      },
    });
    await change(
      O,
      members.filter((m) => m.userId !== U),
    );
    expect(await db.gotyProposal.findUnique({ where: { id: proposal.id } })).toBeNull();
    expect(await db.gotyVote.count({ where: { proposalId: proposal.id } })).toBe(0);
    expect(await db.gotyVote.count({ where: { proposalId: otherProposal.id } })).toBe(1);
  });

  it("refuse membres inconnus, doublons et liste vide avant toute écriture", async () => {
    await expect(
      change(A, [...members, { userId: "absent", organizer: false, presenter: false }]),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      change(A, [...members, { userId: O, organizer: true, presenter: false }]),
    ).rejects.toMatchObject({ status: 400 });
    await expect(change(A, [])).rejects.toMatchObject({ status: 400 });
    expect((await getEdition(access())).edition.version).toBe(2);
    expect(await db.gotyMember.count({ where: { editionId } })).toBe(3);
  });

  it("refuse les remplacements concurrents avec une version périmée", async () => {
    const result = await Promise.allSettled([change(), change()]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect((await getEdition(access())).edition.version).toBe(3);
  });
});
