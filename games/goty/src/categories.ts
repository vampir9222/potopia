import { withTx } from "@app/db";
import { z } from "zod";
import { editionAccess, resolveActor } from "./access";
import { GotyError } from "./errors";
import { mutateEdition, requireParticipant, type EditionInput, type Options } from "./mutate";
import { notifyEditionMembers } from "./notifications";
import { normalizeCategoryName, votesNeeded } from "./rules";
import { accessInput, id, parse } from "./validation";

const categoryName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((value) => value.replace(/\s+/gu, " "))
  .refine((value) => normalizeCategoryName(value).length > 0);
const proposalInput = accessInput.extend({
  name: categoryName.refine((value) => value.length >= 2),
});

export async function proposeCategory(input: EditionInput & { name: string }, opts?: Options) {
  const data = parse(proposalInput, input);
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      if (access.edition.phase !== "categories")
        throw new GotyError("CONFLICT", "Les catégories sont fixées.", 409);
      const normalizedName = normalizeCategoryName(data.name);
      const where = { editionId: data.editionId, normalizedName };
      if (
        (await tx.gotyRound.findUnique({ where: { editionId_normalizedName: where } })) ||
        (await tx.gotyProposal.findUnique({ where: { editionId_normalizedName: where } }))
      ) {
        throw new GotyError("CONFLICT", "Une rubrique ou proposition porte déjà ce nom.", 409);
      }
      const created = await tx.gotyProposal.create({
        data: { ...where, name: data.name, userId: data.actorId },
      });
      return { id: created.id };
    },
    opts,
  );
}

export async function voteCategory(
  input: EditionInput & { proposalId: string; favor: boolean },
  opts?: Options,
) {
  const data = parse(accessInput.extend({ proposalId: id, favor: z.boolean() }), input);
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      if (access.edition.phase !== "categories")
        throw new GotyError("CONFLICT", "Le vote est fermé.", 409);
      if (
        !(await tx.gotyProposal.findFirst({
          where: { id: data.proposalId, editionId: data.editionId },
        }))
      ) {
        throw new GotyError("NOT_FOUND", "Proposition introuvable.", 404);
      }
      const vote = { proposalId: data.proposalId, userId: data.actorId };
      if (data.favor) await tx.gotyVote.createMany({ data: [vote], skipDuplicates: true });
      else await tx.gotyVote.deleteMany({ where: vote });
      return { ok: true as const };
    },
    opts,
  );
}

export async function prepareEdition(
  input: EditionInput & { expectedVersion: number },
  opts?: Options,
) {
  const data = parse(accessInput.extend({ expectedVersion: z.number().int().positive() }), input);
  return mutateEdition(
    data,
    async (tx, access) => {
      if (!access.permissions.organize)
        throw new GotyError("FORBIDDEN", "Accès réservé à l’organisation.", 403);
      if (access.edition.phase !== "categories")
        throw new GotyError("CONFLICT", "La préparation est déjà ouverte.", 409);
      const count = await tx.gotyMember.count({ where: { editionId: data.editionId } });
      if (count === 0) throw new GotyError("CONFLICT", "Enregistre d’abord les participants.", 409);
      const proposals = await tx.gotyProposal.findMany({
        where: { editionId: data.editionId },
        include: { _count: { select: { votes: true } } },
        orderBy: { id: "asc" },
      });
      const last = await tx.gotyRound.aggregate({
        where: { editionId: data.editionId },
        _max: { position: true },
      });
      let position = (last._max.position ?? -1) + 1;
      const accepted = proposals.filter((p) => p._count.votes >= votesNeeded(count));
      if (accepted.length)
        await tx.gotyRound.createMany({
          data: accepted.map((p) => ({
            editionId: data.editionId,
            name: p.name,
            normalizedName: p.normalizedName,
            position: position++,
          })),
        });
      await tx.gotyEdition.update({
        where: { id: data.editionId },
        data: { phase: "preparation" },
      });
      await notifyEditionMembers(
        { ...data, year: access.edition.year, event: "preparation" },
        { tx },
      );
      return { ok: true as const };
    },
    opts,
  );
}

export async function addCategory(input: EditionInput & { name: string }, opts?: Options) {
  const data = parse(accessInput.extend({ name: categoryName }), input);
  return mutateEdition(
    data,
    async (tx, access) => {
      if (!access.permissions.organize)
        throw new GotyError("FORBIDDEN", "Accès réservé à l’organisation.", 403);
      if (access.edition.phase !== "preparation")
        throw new GotyError("CONFLICT", "Ajoute une catégorie pendant la préparation.", 409);
      const normalizedName = normalizeCategoryName(data.name);
      if (
        await tx.gotyRound.findUnique({
          where: { editionId_normalizedName: { editionId: data.editionId, normalizedName } },
        })
      ) {
        throw new GotyError("CONFLICT", "Une rubrique porte déjà ce nom.", 409);
      }
      const last = await tx.gotyRound.aggregate({
        where: { editionId: data.editionId },
        _max: { position: true },
      });
      const created = await tx.gotyRound.create({
        data: {
          editionId: data.editionId,
          name: data.name,
          normalizedName,
          position: (last._max.position ?? -1) + 1,
        },
      });
      return { id: created.id };
    },
    opts,
  );
}

export async function listCategories(input: EditionInput, opts?: Options) {
  const data = parse(accessInput, input);
  const actor = await resolveActor(data.actorId);
  return withTx(async (tx) => {
    await editionAccess(tx, data.editionId, actor);
    const rounds = await tx.gotyRound.findMany({
      where: { editionId: data.editionId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, rank: true, position: true, status: true, soundtrack: true },
    });
    const proposals = await tx.gotyProposal.findMany({
      where: { editionId: data.editionId },
      orderBy: { id: "asc" },
      include: {
        _count: { select: { votes: true } },
        votes: { where: { userId: data.actorId }, select: { userId: true } },
      },
    });
    return {
      rounds,
      proposals: proposals.map((p) => ({
        id: p.id,
        name: p.name,
        votes: p._count.votes,
        voted: p.votes.length > 0,
      })),
    };
  }, opts);
}
