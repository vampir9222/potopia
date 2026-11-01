import { z } from "zod";
import { GotyError } from "./errors";
import { mutateEdition, requireParticipant, type EditionInput, type Options } from "./mutate";
import { accessInput, id, parse } from "./validation";

/** Réordonnancement atomique : un échange ne passe pas par deux choix dupliqués. */
export async function setTopOrder(input: EditionInput & { gameIds: string[] }, opts?: Options) {
  const data = parse(
    accessInput.extend({
      gameIds: z
        .array(id)
        .max(5)
        .refine((ids) => new Set(ids).size === ids.length),
    }),
    input,
  );
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      if (access.edition.phase === "categories")
        throw new GotyError("CONFLICT", "La préparation n’est pas ouverte.", 409);
      const rounds = await tx.gotyRound.findMany({
        where: { editionId: data.editionId, rank: { not: null } },
        orderBy: { rank: "asc" },
      });
      const choices = await tx.gotyChoice.findMany({
        where: { userId: data.actorId, roundId: { in: rounds.map((r) => r.id) } },
      });
      const games = await tx.gotyGame.count({
        where: { id: { in: data.gameIds }, editionId: data.editionId, userId: data.actorId },
      });
      if (games !== data.gameIds.length || rounds.length !== 5)
        throw new GotyError("INVALID_INPUT", "Choisis jusqu’à cinq jeux de ta liste.", 400);
      for (const round of rounds)
        if (
          round.status !== "draft" &&
          (choices.find((c) => c.roundId === round.id)?.gameId ?? null) !==
            (data.gameIds[(round.rank ?? 0) - 1] ?? null)
        )
          throw new GotyError("CONFLICT", "Une place déjà annoncée ne peut plus changer.", 409);
      await tx.gotyChoice.deleteMany({
        where: {
          userId: data.actorId,
          roundId: { in: rounds.filter((r) => r.status === "draft").map((r) => r.id) },
        },
      });
      for (const round of rounds) {
        const gameId = data.gameIds[(round.rank ?? 0) - 1];
        if (round.status !== "draft" || !gameId) continue;
        const previous = choices.find((c) => c.gameId === gameId);
        await tx.gotyChoice.create({
          data: {
            roundId: round.id,
            userId: data.actorId,
            gameId,
            precision: previous?.precision ?? "",
          },
        });
      }
      return { ok: true as const };
    },
    opts,
  );
}
