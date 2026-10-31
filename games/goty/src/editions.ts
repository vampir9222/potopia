import { getUsersByIds, listUsers } from "@app/core";
import { db, withTx, type DbTx } from "@app/db";
import { editionAccess, resolveActor } from "./access";
import { GotyError } from "./errors";
import { initialRounds } from "./rules";
import { accessInput, editionInput, id, membersInput, parse } from "./validation";

const summarySelect = { id: true, year: true, name: true, phase: true } as const;
type Options = { tx?: DbTx };

export async function createEdition(
  input: { actorId: string; year: number; name: string },
  opts?: Options,
) {
  const data = parse(editionInput, input);
  const actor = await resolveActor(data.actorId);
  return withTx(async (tx) => {
    if (
      !actor.admin &&
      !(await tx.gotyMember.findFirst({
        where: { userId: actor.userId, organizer: true },
        select: { userId: true },
      }))
    )
      throw new GotyError("FORBIDDEN", "Accès réservé à l’organisation.", 403);
    // createMany évite une erreur SQL qui annulerait une transaction fournie par l'appelant.
    const editionId = crypto.randomUUID();
    const inserted = await tx.gotyEdition.createMany({
      data: [{ id: editionId, year: data.year, name: data.name }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) throw new GotyError("CONFLICT", "Cette année existe déjà.", 409);
    await tx.gotyMember.create({
      data: {
        editionId,
        userId: actor.userId,
        organizer: true,
        presenter: true,
      },
    });
    await tx.gotyRound.createMany({
      data: initialRounds().map((round) => ({ ...round, editionId })),
    });
    return { id: editionId, version: 1 };
  }, opts);
}

export async function listEditions(actorId: string, opts?: Options) {
  const actor = await resolveActor(parse(id, actorId));
  return (opts?.tx ?? db).gotyEdition.findMany({
    where: actor.admin
      ? {}
      : { OR: [{ phase: "closed" }, { members: { some: { userId: actor.userId } } }] },
    select: summarySelect,
    orderBy: { year: "desc" },
  });
}

/** Vue du socle uniquement : aucun choix, pronostic ou état d'écran brut. */
export async function getEdition(input: { actorId: string; editionId: string }, opts?: Options) {
  const data = parse(accessInput, input);
  const actor = await resolveActor(data.actorId);
  return withTx(async (tx) => {
    const { edition, permissions } = await editionAccess(tx, data.editionId, actor);
    return {
      edition: {
        id: edition.id,
        year: edition.year,
        name: edition.name,
        phase: edition.phase,
        version: edition.version,
      },
      permissions,
    };
  }, opts);
}

/** Identités publiques via core ; aucune jointure ni accès direct à ses tables. */
export async function listEditionMembers(
  input: { actorId: string; editionId: string },
  opts?: Options,
) {
  const data = parse(accessInput, input);
  const actor = await resolveActor(data.actorId);
  const members = await withTx(async (tx) => {
    await editionAccess(tx, data.editionId, actor);
    return tx.gotyMember.findMany({
      where: { editionId: data.editionId },
      orderBy: { userId: "asc" },
    });
  }, opts);
  const users = new Map(
    (await getUsersByIds(members.map((member) => member.userId))).map((user) => [user.id, user]),
  );
  return members.map((member) => ({
    id: member.userId,
    name: users.get(member.userId)?.name ?? "Membre",
    image: users.get(member.userId)?.image ?? null,
    organizer: member.organizer,
    presenter: member.presenter,
  }));
}

export async function listEligibleMembers(
  input: { actorId: string; editionId: string },
  opts?: Options,
) {
  const data = parse(accessInput, input);
  const actor = await resolveActor(data.actorId);
  await withTx(async (tx) => {
    const { permissions } = await editionAccess(tx, data.editionId, actor);
    if (!permissions.organize)
      throw new GotyError("FORBIDDEN", "Accès réservé à l’organisation.", 403);
  }, opts);
  return (await listUsers()).map((user) => ({ id: user.id, name: user.name, image: user.image }));
}

export async function setEditionMembers(
  input: {
    actorId: string;
    editionId: string;
    expectedVersion: number;
    members: { userId: string; organizer: boolean; presenter: boolean }[];
  },
  opts?: Options,
) {
  const data = parse(membersInput, input);
  const actor = await resolveActor(data.actorId);
  return withTx(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "goty"."editions" WHERE id = ${data.editionId} FOR UPDATE`;
    const { edition, permissions } = await editionAccess(tx, data.editionId, actor);
    if (!permissions.organize)
      throw new GotyError("FORBIDDEN", "Accès réservé à l’organisation.", 403);
    if (edition.phase === "closed")
      throw new GotyError("CONFLICT", "Cette édition est archivée.", 409);
    if (edition.version !== data.expectedVersion) {
      throw new GotyError("CONFLICT", "L’édition a changé. Actualise la page.", 409);
    }
    const old = await tx.gotyMember.findMany({ where: { editionId: data.editionId } });
    const next = new Map(data.members.map((member) => [member.userId, member]));
    const previous = new Map(old.map((member) => [member.userId, member]));
    const removed = old.filter((member) => !next.has(member.userId));
    const added = data.members.filter((member) => !previous.has(member.userId));
    if (edition.phase !== "categories" && removed.length) {
      throw new GotyError(
        "CONFLICT",
        "Les participants inscrits ne peuvent plus être retirés.",
        409,
      );
    }
    if (edition.phase === "live" && added.length) {
      throw new GotyError(
        "CONFLICT",
        "Les participants sont fixés depuis le début de la soirée.",
        409,
      );
    }
    if (
      !actor.admin &&
      (!next.get(actor.userId)?.organizer ||
        data.members.some(
          (member) => member.organizer !== Boolean(previous.get(member.userId)?.organizer),
        ) ||
        old.some((member) => member.organizer && !next.get(member.userId)?.organizer))
    )
      throw new GotyError("FORBIDDEN", "Seul l’administrateur désigne les organisateurs.", 403);
    const users = await getUsersByIds(data.members.map((member) => member.userId));
    if (users.length !== data.members.length) {
      throw new GotyError("INVALID_INPUT", "Un membre est introuvable.", 400);
    }
    const removedIds = removed.map((member) => member.userId);
    if (
      removedIds.length &&
      (await tx.gotyGame.findFirst({
        where: { editionId: data.editionId, userId: { in: removedIds } },
        select: { id: true },
      }))
    )
      throw new GotyError("CONFLICT", "Un participant retiré a déjà saisi des jeux.", 409);
    // Toutes les validations précèdent les écritures, même dans une transaction composée.
    if (removedIds.length) {
      await tx.gotyVote.deleteMany({
        where: {
          userId: { in: removedIds },
          proposal: { editionId: data.editionId },
        },
      });
      await tx.gotyProposal.deleteMany({
        where: { editionId: data.editionId, userId: { in: removedIds } },
      });
      await tx.gotyMember.deleteMany({
        where: { editionId: data.editionId, userId: { in: removedIds } },
      });
    }
    for (const member of data.members) {
      await tx.gotyMember.upsert({
        where: { editionId_userId: { editionId: data.editionId, userId: member.userId } },
        create: { editionId: data.editionId, ...member },
        update: { organizer: member.organizer, presenter: member.presenter },
      });
    }
    const updated = await tx.gotyEdition.update({
      where: { id: data.editionId },
      data: { version: { increment: 1 } },
      select: { version: true },
    });
    return { ok: true as const, version: updated.version };
  }, opts);
}
