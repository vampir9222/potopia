import { publishEvent } from "@app/core";
import { Prisma, withTx, type DbTx } from "@app/db";
import valid from "../data/valid.json";
import { computeStats, dayView, encodeMarks, loadGames } from "./day";
import { TroisError } from "./errors";
import { evaluate } from "./evaluate";
import { z } from "zod";
import {
  GRACE_MS,
  MAX_TRIES,
  normalize,
  shiftDate,
  WORD_LEN,
  WORDS_PER_DAY,
  type DayView,
  type Mark,
} from "./game";
import { dayNumber, parisMidnight, todayParis, wordsFor } from "./words";

const VALID = new Set(valid as string[]);

export type Stats = Awaited<ReturnType<typeof computeStats>>;

/** Mot normalisé et accepté comme essai, sinon TroisError (400 ou 422). */
function checkWord(input: unknown): string {
  const guess = normalize(String(input ?? ""));
  if (guess.length !== WORD_LEN) throw new TroisError(400, "Il faut 5 lettres");
  if (!VALID.has(guess)) throw new TroisError(422, "Mot inconnu");
  return guess;
}

type Games = Awaited<ReturnType<typeof loadGames>>;

/**
 * Journée d'hier encore jouable : délai de grâce pas écoulé, journée commencée avant minuit et pas
 * finie, et nouvelle journée pas encore commencée (la commencer, c'est laisser tomber l'ancienne).
 */
async function graceDay(userId: string, now: Date): Promise<{ date: string; games: Games } | null> {
  const today = todayParis(now);
  if (now.getTime() >= parisMidnight(today) + GRACE_MS) return null;
  const date = shiftDate(today, -1);
  const [games, todays] = await Promise.all([loadGames(userId, date), loadGames(userId, today)]);
  const started = games.some((g) => g.guesses.length > 0);
  const over = games.length === WORDS_PER_DAY && games.every((g) => g.status !== "PLAYING");
  if (!started || over || todays.some((g) => g.guesses.length > 0)) return null;
  return { date, games };
}

const dateInput = z.iso.date().optional();

/**
 * La journée du joueur (réponses visibles seulement pour les mots terminés) et ses stats. Juste
 * après minuit, c'est encore celle d'hier s'il l'avait commencée (délai de grâce), sauf s'il demande
 * à passer aux nouveaux mots (`today`).
 */
export async function getToday(
  userId: string,
  opts?: { today?: boolean; now?: Date },
): Promise<{ day: DayView; stats: Stats }> {
  const now = opts?.now ?? new Date();
  const grace = opts?.today ? null : await graceDay(userId, now);
  const date = grace?.date ?? todayParis(now);
  const [games, stats] = await Promise.all([
    grace?.games ?? loadGames(userId, date),
    computeStats(userId, now),
  ]);
  return { day: await dayView(date, games), stats };
}

/**
 * Un essai sur le mot en cours. Le serveur valide le mot, le compare à la réponse (qui ne quitte
 * jamais le serveur) et renvoie le feedback lettre par lettre. Le client dit quelle journée il
 * joue (`date`) ; le serveur n'accepte que la sienne, ou celle d'hier pendant le délai de grâce :
 * un essai pensé pour hier n'est jamais compté pour aujourd'hui.
 */
export async function playGuess(
  input: { userId: string; guess: unknown; slot?: unknown; date?: unknown },
  opts?: { tx?: DbTx; now?: Date },
): Promise<{ slot: number; marks: Mark[]; day: DayView; stats: Stats }> {
  const { userId } = input;
  const guess = checkWord(input.guess);
  const parsed = dateInput.safeParse(input.date);
  if (!parsed.success) throw new TroisError(400, "Date invalide");
  const now = opts?.now ?? new Date();
  const today = todayParis(now);
  let date = today;
  let games: Games;
  if (parsed.data === undefined || parsed.data === today) {
    games = await loadGames(userId, date);
  } else {
    const grace = await graceDay(userId, now);
    if (grace?.date !== parsed.data) {
      throw new TroisError(409, "Minuit est passé : voici les nouveaux mots !");
    }
    ({ date, games } = grace);
  }

  // mot en cours = premier créneau non terminé (on joue les 3 mots dans l'ordre)
  let slot = 0;
  while (slot < WORDS_PER_DAY && games.find((g) => g.slot === slot && g.status !== "PLAYING"))
    slot++;
  if (slot >= WORDS_PER_DAY)
    throw new TroisError(409, "Tu as fini pour aujourd'hui, reviens demain !");
  if (input.slot !== undefined && input.slot !== slot) {
    throw new TroisError(409, "Ce mot n'est pas le mot en cours");
  }

  const answer = (await wordsFor(date))[slot] ?? "";
  const marks = evaluate(guess, answer);
  const attempt = (games.find((g) => g.slot === slot)?.guesses.length ?? 0) + 1;
  const status = guess === answer ? "WON" : attempt >= MAX_TRIES ? "LOST" : "PLAYING";

  try {
    await withTx(async (tx) => {
      const game = await tx.troisGame.upsert({
        where: { userId_date_slot: { userId, date, slot } },
        create: { userId, date, slot, status },
        update: { status },
      });
      // contrainte unique (gameId, attempt) : deux requêtes simultanées ne passent pas toutes les deux
      await tx.troisGuess.create({
        data: { gameId: game.id, attempt, word: guess, marks: encodeMarks(marks) },
      });

      // dernier mot terminé : la journée apparaît dans le fil d'activité (score seulement, sans lettres)
      if (slot === WORDS_PER_DAY - 1 && status !== "PLAYING") {
        const found =
          games.filter((g) => g.slot !== slot && g.status === "WON").length +
          (status === "WON" ? 1 : 0);
        await publishEvent(
          {
            userId,
            app: "trois",
            type: "day_completed",
            payload: { number: dayNumber(date), found },
          },
          { tx },
        );
      }
    }, opts);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TroisError(409, "Essai déjà envoyé, recharge la page");
    }
    throw error;
  }

  const after = await loadGames(userId, date);
  return { slot, marks, day: await dayView(date, after), stats: await computeStats(userId, now) };
}

/**
 * Mode test : rejouer pour de faux un mot du jour déjà terminé. Rien n'est enregistré, et seul un
 * mot dont le joueur connaît déjà la réponse est accepté.
 */
export async function practiceGuess(input: {
  userId: string;
  guess: unknown;
  slot: unknown;
}): Promise<{ marks: Mark[] }> {
  const slot = Number(input.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot >= WORDS_PER_DAY) {
    throw new TroisError(400, "Mot invalide");
  }
  const guess = checkWord(input.guess);
  const date = todayParis();
  const game = (await loadGames(input.userId, date)).find((g) => g.slot === slot);
  if (!game || game.status === "PLAYING") {
    throw new TroisError(409, "Termine d'abord ce mot pour de vrai");
  }
  const answer = (await wordsFor(date))[slot] ?? "";
  return { marks: evaluate(guess, answer) };
}
