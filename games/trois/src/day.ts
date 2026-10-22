import { db } from "@app/db";
import { MAX_TRIES, WORDS_PER_DAY, type Mark } from "./game";
import { dayNumber, todayParis, wordsFor } from "./words";

const CODE: Record<Mark, string> = { correct: "C", present: "P", absent: "A" };
const DECODE: Record<string, Mark> = { C: "correct", P: "present", A: "absent" };
export const encodeMarks = (m: Mark[]) => m.map((x) => CODE[x]).join("");
export const decodeMarks = (s: string): Mark[] => [...s].map((c) => DECODE[c] ?? "absent");

type GameRow = {
  slot: number;
  status: "PLAYING" | "WON" | "LOST";
  guesses: { word: string; marks: string }[];
};

const STATUS = { PLAYING: "playing", WON: "won", LOST: "lost" } as const;

/** État d'une journée tel que le joueur a le droit de le voir. */
export async function dayView(date: string, games: GameRow[], { withLetters = true } = {}) {
  // les amis ne voient jamais les lettres : inutile de charger les réponses
  const answers = withLetters ? await wordsFor(date) : [];
  const words = Array.from({ length: WORDS_PER_DAY }, (_, slot) => {
    const g = games.find((x) => x.slot === slot);
    const status = g ? STATUS[g.status] : "playing";
    return {
      status,
      tries: g?.guesses.length ?? 0,
      marks: (g?.guesses ?? []).map((x) => decodeMarks(x.marks)),
      guesses: withLetters ? (g?.guesses ?? []).map((x) => x.word) : undefined,
      // la réponse n'est révélée que si le mot est terminé
      answer: withLetters && status !== "playing" ? answers[slot] : undefined,
    };
  });
  return {
    date,
    number: dayNumber(date),
    maxTries: MAX_TRIES,
    over: words.every((w) => w.status !== "playing"),
    words,
  };
}

export async function loadGames(userId: string, date = todayParis()) {
  return db.troisGame.findMany({
    where: { userId, date },
    select: {
      slot: true,
      status: true,
      guesses: { select: { word: true, marks: true }, orderBy: { attempt: "asc" } },
    },
  });
}

function prevDate(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Série : jours consécutifs terminés, jusqu'à aujourd'hui (ou hier si pas encore joué aujourd'hui). */
function currentStreak(done: Set<string>) {
  let d = todayParis();
  if (!done.has(d)) d = prevDate(d);
  let streak = 0;
  while (done.has(d)) {
    streak++;
    d = prevDate(d);
  }
  return streak;
}

/** Séries de plusieurs joueurs en une seule requête (pour le classement). */
export async function streaksFor(userIds: string[]) {
  const games = await db.troisGame.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, date: true, status: true },
  });
  const byUser = new Map<string, Map<string, typeof games>>();
  for (const g of games) {
    const days = byUser.get(g.userId) ?? new Map<string, typeof games>();
    days.set(g.date, [...(days.get(g.date) ?? []), g]);
    byUser.set(g.userId, days);
  }
  const result = new Map<string, number>();
  for (const [userId, days] of byUser) {
    const done = new Set(
      [...days]
        .filter(([, gs]) => gs.length === WORDS_PER_DAY && gs.every((g) => g.status !== "PLAYING"))
        .map(([d]) => d),
    );
    result.set(userId, currentStreak(done));
  }
  return result;
}

/** Statistiques calculées à partir de l'historique des parties. */
export async function computeStats(userId: string) {
  const games = await db.troisGame.findMany({
    where: { userId },
    select: { date: true, status: true, _count: { select: { guesses: true } } },
  });
  const byDate = new Map<string, typeof games>();
  for (const g of games) byDate.set(g.date, [...(byDate.get(g.date) ?? []), g]);

  const dist = Array(MAX_TRIES).fill(0);
  let wordsFound = 0;
  for (const g of games) {
    if (g.status !== "WON") continue;
    wordsFound++;
    dist[g._count.guesses - 1]++;
  }

  const done = new Set(
    [...byDate]
      .filter(([, gs]) => gs.length === WORDS_PER_DAY && gs.every((g) => g.status !== "PLAYING"))
      .map(([d]) => d),
  );
  const perfectDays = [...byDate].filter(
    ([, gs]) => gs.length === WORDS_PER_DAY && gs.every((g) => g.status === "WON"),
  ).length;

  const streak = currentStreak(done);

  let maxStreak = 0;
  let run = 0;
  let last = "";
  for (const day of [...done].sort()) {
    run = last && prevDate(day) === last ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
    last = day;
  }

  return { played: done.size, wordsFound, perfectDays, streak, maxStreak, dist };
}
