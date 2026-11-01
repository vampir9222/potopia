import { withTx } from "@app/db";
import { z } from "zod";
import { editionAccess, resolveActor } from "./access";
import { GotyError } from "./errors";
import { gameInputSchema, type GameInput } from "./game-input";
import { mutateEdition, requireParticipant, type EditionInput, type Options } from "./mutate";
import { accessInput, id, parse } from "./validation";

function requireOpenLists(phase: string) {
  if (phase !== "categories" && phase !== "preparation")
    throw new GotyError(
      "CONFLICT",
      "Les listes de jeux sont figées depuis le début de la soirée.",
      409,
    );
}

export async function addGames(input: EditionInput & { games: GameInput[] }, opts?: Options) {
  const data = parse(
    accessInput.extend({ games: z.array(gameInputSchema).min(1).max(1000) }),
    input,
  );
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      requireOpenLists(access.edition.phase);
      await tx.gotyGame.createMany({
        data: data.games.map((game) => ({
          ...game,
          editionId: data.editionId,
          userId: data.actorId,
        })),
      });
      return { ok: true as const, count: data.games.length };
    },
    opts,
  );
}

export async function updateGame(
  input: EditionInput & { gameId: string; game: GameInput },
  opts?: Options,
) {
  const data = parse(accessInput.extend({ gameId: id, game: gameInputSchema }), input);
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      requireOpenLists(access.edition.phase);
      const game = await tx.gotyGame.findFirst({
        where: { id: data.gameId, editionId: data.editionId, userId: data.actorId },
      });
      if (!game) throw new GotyError("NOT_FOUND", "Jeu introuvable.", 404);
      if (
        await tx.gotyChoice.findFirst({
          where: { gameId: game.id, round: { status: { not: "draft" } } },
        })
      )
        throw new GotyError("CONFLICT", "Ce jeu fait partie d’une rubrique déjà annoncée.", 409);
      await tx.gotyGame.update({ where: { id: game.id }, data: data.game });
      return { ok: true as const };
    },
    opts,
  );
}

export async function deleteGame(input: EditionInput & { gameId: string }, opts?: Options) {
  const data = parse(accessInput.extend({ gameId: id }), input);
  return mutateEdition(
    data,
    async (tx, access) => {
      requireParticipant(access.membership);
      requireOpenLists(access.edition.phase);
      const game = await tx.gotyGame.findFirst({
        where: { id: data.gameId, editionId: data.editionId, userId: data.actorId },
      });
      if (!game) throw new GotyError("NOT_FOUND", "Jeu introuvable.", 404);
      if (
        (await tx.gotyChoice.findFirst({ where: { gameId: game.id } })) ||
        (await tx.gotyPrediction.findFirst({ where: { gameId: game.id } }))
      )
        throw new GotyError(
          "CONFLICT",
          "Ce jeu est utilisé dans un palmarès ou un pronostic et doit être conservé.",
          409,
        );
      await tx.gotyGame.delete({ where: { id: game.id } });
      return { ok: true as const };
    },
    opts,
  );
}

export async function listGames(input: EditionInput, opts?: Options) {
  const data = parse(accessInput, input);
  const actor = await resolveActor(data.actorId);
  return withTx(async (tx) => {
    await editionAccess(tx, data.editionId, actor);
    return tx.gotyGame.findMany({
      where: { editionId: data.editionId },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        userId: true,
        title: true,
        platform: true,
        period: true,
        completed: true,
        platinum: true,
        igdbId: true,
        cover: true,
        trailerYoutubeId: true,
      },
    });
  }, opts);
}
