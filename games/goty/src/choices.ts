import { withTx } from "@app/db";
import { z } from "zod";
import { editionAccess, resolveActor } from "./access";
import { GotyError } from "./errors";
import { mutateEdition, requireParticipant, type EditionInput, type Options } from "./mutate";
import { youtubeId } from "./rules";
import { accessInput, id, parse } from "./validation";

const choiceInput = accessInput.extend({
  roundId: id,
  gameId: id.nullable(),
  precision: z.string().max(500).default(""),
  youtube: z.string().trim().max(255).nullable().default(null),
});

export async function setChoice(
  input: EditionInput & {
    roundId: string;
    gameId: string | null;
    precision?: string;
    youtube?: string | null;
  },
  opts?: Options,
) {
  const data = parse(choiceInput, input);
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      if (access.edition.phase === "categories")
        throw new GotyError("CONFLICT", "La préparation des palmarès n’est pas ouverte.", 409);
      const round = await tx.gotyRound.findFirst({
        where: { id: data.roundId, editionId: data.editionId },
      });
      if (!round) throw new GotyError("NOT_FOUND", "Rubrique introuvable.", 404);
      if (round.status !== "draft")
        throw new GotyError("CONFLICT", "Cette rubrique est déjà annoncée.", 409);
      const key = { roundId: round.id, userId: data.actorId };
      if (data.gameId === null) {
        await tx.gotyChoice.deleteMany({ where: key });
        return { ok: true as const };
      }
      if (
        !(await tx.gotyGame.findFirst({
          where: { id: data.gameId, userId: data.actorId, editionId: data.editionId },
        }))
      )
        throw new GotyError("INVALID_INPUT", "Choisis un jeu de ta liste.", 400);
      if (
        round.rank !== null &&
        (await tx.gotyChoice.findFirst({
          where: {
            userId: data.actorId,
            gameId: data.gameId,
            roundId: { not: round.id },
            round: { editionId: data.editionId, rank: { not: null } },
          },
        }))
      )
        throw new GotyError("CONFLICT", "Un jeu ne peut occuper qu’une place dans le top.", 409);
      const video = data.youtube ? youtubeId(data.youtube) : null;
      if (data.youtube && (!round.soundtrack || !video))
        throw new GotyError(
          "INVALID_INPUT",
          "Saisis un lien YouTube valide pour la bande-son.",
          400,
        );
      const choice = {
        gameId: data.gameId,
        precision: data.precision,
        youtube: video ? `https://www.youtube.com/watch?v=${video}` : null,
      };
      await tx.gotyChoice.upsert({
        where: { roundId_userId: key },
        create: { ...key, ...choice },
        update: choice,
      });
      return { ok: true as const };
    },
    opts,
  );
}

/** Pas de paramètre cible : l'acteur peut uniquement lire ses propres choix. */
export async function listOwnChoices(input: EditionInput, opts?: Options) {
  const data = parse(accessInput, input);
  const actor = await resolveActor(data.actorId);
  return withTx(async (tx) => {
    const access = await editionAccess(tx, data.editionId, actor);
    requireParticipant(access.membership);
    return tx.gotyChoice.findMany({
      where: { userId: data.actorId, round: { editionId: data.editionId } },
      orderBy: { roundId: "asc" },
      select: { roundId: true, userId: true, gameId: true, precision: true, youtube: true },
    });
  }, opts);
}
