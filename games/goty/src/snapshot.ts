import { getUsersByIds } from "@app/core";
import { withTx } from "@app/db";
import { editionAccess, resolveActor } from "./access";
import { type EditionInput, type Options } from "./mutate";
import { rankScores } from "./rules";
import { readScreen } from "./screen";
import { accessInput, parse } from "./validation";

/**
 * Toutes les données GOTY sont lues sous le verrou partagé de l'édition. En READ COMMITTED,
 * il empêche les mutations métier (FOR UPDATE) de changer version, tirages ou choix entre
 * deux requêtes de ce snapshot, y compris quand l'appelant fournit sa propre transaction.
 */
async function buildSnapshots(input: EditionInput, opts?: Options) {
  const data = parse(accessInput, input);
  const actor = await resolveActor(data.actorId);
  return withTx(async (tx) => {
    const access = await editionAccess(tx, data.editionId, actor);
    const { edition, permissions } = access;
    const members = await tx.gotyMember.findMany({
      where: { editionId: data.editionId },
      orderBy: { userId: "asc" },
    });
    const games = await tx.gotyGame.findMany({
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
    const rounds = await tx.gotyRound.findMany({
      where: { editionId: data.editionId },
      orderBy: { position: "asc" },
    });
    const choices = await tx.gotyChoice.findMany({
      where: { round: { editionId: data.editionId } },
      orderBy: [{ roundId: "asc" }, { userId: "asc" }],
      select: { roundId: true, userId: true, gameId: true, precision: true, youtube: true },
    });
    const predictions = await tx.gotyPrediction.findMany({
      where: { round: { editionId: data.editionId } },
      orderBy: [{ roundId: "asc" }, { userId: "asc" }, { targetId: "asc" }],
      select: { roundId: true, userId: true, targetId: true, gameId: true },
    });
    const proposals = await tx.gotyProposal.findMany({
      where: { editionId: data.editionId },
      orderBy: { id: "asc" },
      include: {
        _count: { select: { votes: true } },
        votes: { where: { userId: data.actorId }, select: { userId: true } },
      },
    });
    const users = new Map(
      (await getUsersByIds(members.map((m) => m.userId))).map((user) => [user.id, user]),
    );
    const identities = members.map((m) => ({
      id: m.userId,
      name: users.get(m.userId)?.name ?? "Membre",
      image: users.get(m.userId)?.image ?? null,
    }));
    const visibleRounds = rounds.map((round) => ({
      id: round.id,
      name: round.name,
      rank: round.rank,
      position: round.position,
      status: round.status,
      soundtrack: round.soundtrack,
      revealedCount: round.status === "draft" ? 0 : round.revealedCount,
      revealedUsers:
        round.status === "draft" ? [] : round.revealOrder.slice(0, round.revealedCount),
      eligibleCount: round.status === "draft" ? null : round.revealOrder.length,
      eligibleUsers: round.status === "draft" ? null : [...round.revealOrder].sort(),
    }));
    const revealed = new Map(visibleRounds.map((r) => [r.id, new Set(r.revealedUsers)]));
    const isRevealed = (roundId: string, userId: string) =>
      revealed.get(roundId)?.has(userId) ?? false;
    const publicChoices = choices.filter((c) => isRevealed(c.roundId, c.userId));
    const publicPredictions = predictions.filter((p) => isRevealed(p.roundId, p.targetId));
    const answers = new Map<string, Map<string, string>>();
    for (const c of publicChoices) {
      const answersForRound = answers.get(c.roundId) ?? new Map<string, string>();
      answersForRound.set(c.userId, c.gameId);
      answers.set(c.roundId, answersForRound);
    }
    const points = new Map<string, number>();
    for (const p of publicPredictions)
      if (answers.get(p.roundId)?.get(p.targetId) === p.gameId)
        points.set(p.userId, (points.get(p.userId) ?? 0) + 1);
    const standings = rankScores(
      identities.map((member) => ({ ...member, points: points.get(member.id) ?? 0 })),
    );
    const screen = readScreen(edition.screen);
    // La commande audio ne doit jamais identifier un choix qui n'a pas été révélé.
    if (
      screen.audio &&
      (!screen.roundId ||
        !isRevealed(screen.roundId, screen.audio.userId) ||
        !publicChoices.some(
          (c) => c.roundId === screen.roundId && c.userId === screen.audio?.userId && c.youtube,
        ))
    )
      screen.audio = null;
    const publicEdition = {
      id: edition.id,
      year: edition.year,
      name: edition.name,
      phase: edition.phase,
      version: edition.version,
      screen,
    };
    const showStandings = screen.mode === "leaderboard" || edition.phase === "closed";
    const publicGameIds = new Set(publicChoices.map((c) => c.gameId));
    const presentation = {
      edition: publicEdition,
      members: identities,
      games: games.filter((g) => publicGameIds.has(g.id)),
      rounds: visibleRounds.map(
        ({ eligibleCount: _count, eligibleUsers: _users, ...round }) => round,
      ),
      choices: publicChoices,
      predictions: publicPredictions,
      standings: showStandings ? standings : null,
    };
    const gameCounts = new Map<string, number>();
    const choiceCounts = new Map<string, number>();
    for (const g of games) gameCounts.set(g.userId, (gameCounts.get(g.userId) ?? 0) + 1);
    for (const c of choices) choiceCounts.set(c.userId, (choiceCounts.get(c.userId) ?? 0) + 1);
    const member = {
      edition: publicEdition,
      permissions,
      members: members.map((m) => ({
        id: m.userId,
        name: users.get(m.userId)?.name ?? "Membre",
        image: users.get(m.userId)?.image ?? null,
        organizer: m.organizer,
        presenter: m.presenter,
        gameCount: gameCounts.get(m.userId) ?? 0,
        choiceCount: choiceCounts.get(m.userId) ?? 0,
      })),
      games,
      rounds: visibleRounds,
      choices: choices.filter((c) => c.userId === actor.userId || isRevealed(c.roundId, c.userId)),
      predictions: predictions.filter(
        (p) => p.userId === actor.userId || isRevealed(p.roundId, p.targetId),
      ),
      proposals: proposals.map((p) => ({
        id: p.id,
        name: p.name,
        votes: p._count.votes,
        voted: p.votes.length > 0,
      })),
      standings: showStandings || permissions.present ? standings : null,
    };
    return { member, presentation };
  }, opts);
}

export async function getMemberSnapshot(input: EditionInput, opts?: Options) {
  return (await buildSnapshots(input, opts)).member;
}

/** Identique pour tous les rôles ; aucune réponse personnelle cachée, même sur le compte admin. */
export async function getPresentationSnapshot(input: EditionInput, opts?: Options) {
  return (await buildSnapshots(input, opts)).presentation;
}

export type MemberSnapshot = Awaited<ReturnType<typeof getMemberSnapshot>>;
export type PresentationSnapshot = Awaited<ReturnType<typeof getPresentationSnapshot>>;
