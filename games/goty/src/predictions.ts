import { GotyError } from "./errors";
import { mutateEdition, requireParticipant, type EditionInput, type Options } from "./mutate";
import { predictionOpen } from "./rules";
import { accessInput, id, parse } from "./validation";

export async function setPrediction(
  input: EditionInput & { roundId: string; targetId: string; gameId: string | null },
  opts?: Options,
) {
  const data = parse(
    accessInput.extend({ roundId: id, targetId: id, gameId: id.nullable() }),
    input,
  );
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      if (data.targetId === data.actorId)
        throw new GotyError("FORBIDDEN", "Pronostique uniquement les choix des autres.", 403);
      if (
        !(await tx.gotyMember.findUnique({
          where: { editionId_userId: { editionId: data.editionId, userId: data.targetId } },
        }))
      ) {
        throw new GotyError("INVALID_INPUT", "Participant introuvable.", 400);
      }
      const round = await tx.gotyRound.findFirst({
        where: { id: data.roundId, editionId: data.editionId },
      });
      if (!round) throw new GotyError("NOT_FOUND", "Rubrique introuvable.", 404);
      if (!predictionOpen(round.status, access.edition.phase))
        throw new GotyError("CONFLICT", "Les pronostics sont fermés.", 409);
      if (round.status !== "draft" && !round.revealOrder.includes(data.targetId)) {
        throw new GotyError(
          "CONFLICT",
          "Ce participant n’a aucun choix pour cette rubrique. Son pronostic est neutralisé.",
          409,
        );
      }
      const key = { roundId: round.id, userId: data.actorId, targetId: data.targetId };
      if (data.gameId === null) {
        await tx.gotyPrediction.deleteMany({ where: key });
        return { ok: true as const };
      }
      if (
        !(await tx.gotyGame.findFirst({
          where: { id: data.gameId, editionId: data.editionId, userId: data.targetId },
        }))
      ) {
        throw new GotyError("INVALID_INPUT", "Choisis un jeu de la liste de ce participant.", 400);
      }
      await tx.gotyPrediction.upsert({
        where: { roundId_userId_targetId: key },
        create: { ...key, gameId: data.gameId },
        update: { gameId: data.gameId },
      });
      return { ok: true as const };
    },
    opts,
  );
}
