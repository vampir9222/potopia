import { randomUUID } from "node:crypto";
import { z } from "zod";
import { GotyError } from "./errors";
import { mutateEdition, type EditionInput, type Options } from "./mutate";
import { notifyEditionMembers } from "./notifications";
import { shuffle } from "./rules";
import { readScreen, type CeremonyScreen } from "./screen";
import { accessInput, id, parse } from "./validation";

const versioned = accessInput.extend({ expectedVersion: z.number().int().positive() });
const controlSchema = z.discriminatedUnion("action", [
  versioned.extend({
    action: z.enum(["announce", "lock", "reopen", "reveal", "recap"]),
    roundId: id,
  }),
  versioned.extend({ action: z.literal("play"), targetId: id }),
  versioned.extend({ action: z.literal("restart"), confirmRestart: z.literal(true) }),
  versioned.extend({ action: z.enum(["leaderboard", "resume", "close", "stop"]) }),
]);
export type ControlInput = z.input<typeof controlSchema>;
export type ControlAction = ControlInput["action"];
export { controlSchema as controlInputSchema };

function conflict(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GotyError("CONFLICT", message, 409);
}

export async function controlEdition(input: ControlInput, opts?: Options) {
  const data = parse(controlSchema, input);
  return mutateEdition(
    data,
    async (tx, access) => {
      if (!access.permissions.present)
        throw new GotyError("FORBIDDEN", "Accès réservé au présentateur.", 403);
      conflict(
        access.edition.phase === "preparation" || access.edition.phase === "live",
        "Ouvre d’abord la préparation des palmarès.",
      );
      if (data.action === "restart") {
        await tx.gotyRound.updateMany({
          where: { editionId: data.editionId },
          data: { status: "draft", revealOrder: [], revealedCount: 0 },
        });
        await tx.gotyEdition.update({
          where: { id: data.editionId },
          data: { phase: "preparation", screen: { mode: "waiting", roundId: null, audio: null } },
        });
        if (access.edition.phase === "live")
          await notifyEditionMembers(
            { ...data, year: access.edition.year, event: "restart" },
            { tx },
          );
        return { ok: true as const };
      }
      const rounds = await tx.gotyRound.findMany({
        where: { editionId: data.editionId },
        orderBy: { position: "asc" },
      });
      const screen: CeremonyScreen = readScreen(access.edition.screen);
      if ("roundId" in data) {
        const round = rounds.find((r) => r.id === data.roundId);
        if (!round) throw new GotyError("NOT_FOUND", "Rubrique introuvable.", 404);
        if (data.action === "announce") {
          conflict(round.status === "draft", "Cette rubrique a déjà été annoncée.");
          conflict(
            !rounds.some((r) => ["announced", "locked", "revealing"].includes(r.status)),
            "Termine la rubrique en cours.",
          );
          conflict(
            rounds.find((r) => r.status === "draft")?.id === round.id,
            "Respecte l’ordre des rubriques.",
          );
          if (round.rank !== null) {
            const top = await tx.gotyChoice.findMany({
              where: { round: { editionId: data.editionId, rank: { not: null } } },
              select: { userId: true, round: { select: { rank: true } } },
            });
            const ranks = new Map<string, number[]>();
            for (const choice of top)
              if (choice.round.rank !== null)
                ranks.set(choice.userId, [...(ranks.get(choice.userId) ?? []), choice.round.rank]);
            conflict(
              [...ranks.values()].every((values) =>
                values.sort((a, b) => a - b).every((rank, index) => rank === index + 1),
              ),
              "Les tops doivent être remplis sans trou, à partir de la place 1.",
            );
          }
          const members = await tx.gotyMember.findMany({
            where: { editionId: data.editionId },
            select: { userId: true },
          });
          const choices = await tx.gotyChoice.findMany({
            where: { roundId: round.id, userId: { in: members.map((m) => m.userId) } },
            select: { userId: true },
          });
          await tx.gotyRound.update({
            where: { id: round.id },
            data: {
              status: "announced",
              revealOrder: shuffle(choices.map((c) => c.userId)),
              revealedCount: 0,
            },
          });
          await tx.gotyEdition.update({
            where: { id: data.editionId },
            data: { phase: "live", screen: { mode: "round", roundId: round.id, audio: null } },
          });
          if (access.edition.phase === "preparation")
            await notifyEditionMembers(
              { ...data, year: access.edition.year, event: "live" },
              { tx },
            );
          return { ok: true as const };
        }
        if (data.action === "lock") {
          conflict(round.status === "announced", "Annonce d’abord la rubrique.");
          await tx.gotyRound.update({ where: { id: round.id }, data: { status: "locked" } });
        } else if (data.action === "reopen") {
          conflict(
            (round.status === "locked" || round.status === "revealing") &&
              round.revealedCount === 0,
            "Les pronostics ne peuvent plus être rouverts.",
          );
          await tx.gotyRound.update({ where: { id: round.id }, data: { status: "announced" } });
          screen.audio = null;
        } else if (data.action === "reveal") {
          conflict(
            (round.status === "locked" || round.status === "revealing") &&
              round.revealedCount < round.revealOrder.length,
            "Ferme les pronostics ou passe au récapitulatif.",
          );
          const userId = round.revealOrder[round.revealedCount];
          conflict(userId, "Aucun choix à révéler.");
          await tx.gotyRound.update({
            where: { id: round.id },
            data: { status: "revealing", revealedCount: { increment: 1 } },
          });
          const choice = round.soundtrack
            ? await tx.gotyChoice.findUnique({
                where: { roundId_userId: { roundId: round.id, userId } },
                select: { youtube: true },
              })
            : null;
          screen.mode = "round";
          screen.roundId = round.id;
          screen.audio = choice?.youtube ? { userId, nonce: randomUUID() } : null;
          delete screen.previousMode;
        } else if (data.action === "recap") {
          conflict(
            ["locked", "revealing", "done"].includes(round.status) &&
              round.revealedCount === round.revealOrder.length,
            "Révèle tous les choix avant le récapitulatif.",
          );
          await tx.gotyRound.update({ where: { id: round.id }, data: { status: "done" } });
          screen.mode = "recap";
          screen.roundId = round.id;
          screen.audio = null;
          delete screen.previousMode;
        }
      } else if (data.action === "leaderboard") {
        if (screen.mode !== "leaderboard") screen.previousMode = screen.mode;
        screen.mode = "leaderboard";
        screen.audio = null;
      } else if (data.action === "resume") {
        conflict(screen.mode === "leaderboard", "Le classement temporaire n’est pas affiché.");
        screen.mode = screen.previousMode ?? (screen.roundId ? "round" : "waiting");
        screen.audio = null;
        delete screen.previousMode;
      } else if (data.action === "play") {
        const round = rounds.find((r) => r.id === screen.roundId);
        conflict(
          (screen.mode === "round" || screen.mode === "recap") &&
            round?.soundtrack &&
            round.revealOrder.slice(0, round.revealedCount).includes(data.targetId),
          "Affiche et révèle d’abord ce choix de bande-son.",
        );
        const choice = await tx.gotyChoice.findUnique({
          where: { roundId_userId: { roundId: round.id, userId: data.targetId } },
          select: { youtube: true },
        });
        if (!choice?.youtube)
          throw new GotyError("INVALID_INPUT", "Aucune vidéo YouTube associée.", 400);
        screen.audio = { userId: data.targetId, nonce: randomUUID() };
      } else if (data.action === "stop") {
        screen.audio = null;
      } else if (data.action === "close") {
        conflict(
          access.edition.phase === "live" && rounds.every((r) => r.status === "done"),
          "Termine toutes les rubriques avant de clôturer.",
        );
        await tx.gotyEdition.update({
          where: { id: data.editionId },
          data: { phase: "closed", screen: { mode: "leaderboard", roundId: null, audio: null } },
        });
        await notifyEditionMembers({ ...data, year: access.edition.year, event: "closed" }, { tx });
        return { ok: true as const };
      }
      await tx.gotyEdition.update({ where: { id: data.editionId }, data: { screen } });
      return { ok: true as const };
    },
    opts,
  );
}

export async function setRoundOrder(
  input: EditionInput & { expectedVersion: number; roundIds: string[] },
  opts?: Options,
) {
  const data = parse(versioned.extend({ roundIds: z.array(id).min(1) }), input);
  return mutateEdition(
    data,
    async (tx, access) => {
      if (!access.permissions.organize && !access.permissions.present)
        throw new GotyError("FORBIDDEN", "Accès réservé à l’organisation ou au présentateur.", 403);
      const rounds = await tx.gotyRound.findMany({
        where: { editionId: data.editionId },
        orderBy: { position: "asc" },
      });
      if (
        data.roundIds.length !== rounds.length ||
        new Set(data.roundIds).size !== rounds.length ||
        rounds.some((r) => !data.roundIds.includes(r.id))
      )
        throw new GotyError(
          "INVALID_INPUT",
          "L’ordre doit contenir chaque rubrique exactement une fois.",
          400,
        );
      conflict(
        rounds.every((r) => r.status === "draft" || data.roundIds[r.position] === r.id),
        "Seules les rubriques à venir peuvent être déplacées.",
      );
      // Deux passes pour respecter la clé unique (édition, position), même lors d'un échange.
      const temporary = Math.max(...rounds.map((r) => r.position)) + rounds.length + 1;
      for (const [index, round] of rounds.entries())
        if (round.status === "draft")
          await tx.gotyRound.update({
            where: { id: round.id },
            data: { position: temporary + index },
          });
      const draftIds = new Set(rounds.filter((r) => r.status === "draft").map((r) => r.id));
      for (const [position, roundId] of data.roundIds.entries())
        if (draftIds.has(roundId))
          await tx.gotyRound.update({ where: { id: roundId }, data: { position } });
      return { ok: true as const };
    },
    opts,
  );
}
