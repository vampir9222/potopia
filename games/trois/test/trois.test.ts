import { listRecentEvents } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import solutions from "../data/solutions.json";
import { evaluate } from "../src/evaluate";
import {
  dayLeaderboard,
  getToday,
  periodLeaderboard,
  playGuess,
  practiceGuess,
  TroisError,
} from "../src/index";
import { parisMidnight, resetWordsCache, todayParis, wordsFor } from "../src/words";

const ME = "user-me";
const OTHER = "user-other";
// Mots du jour imposés par les tests (tous dans les listes du jeu).
const ANSWERS = ["faire", "temps", "chose"];
const WRONG = "monde";

async function setAnswers(words = ANSWERS): Promise<void> {
  await db.troisDailyWord.createMany({
    data: words.map((word, slot) => ({ date: todayParis(), slot, word })),
  });
}

/** Termine les 3 mots : le 1er en 1 essai, le 2e en 2, le 3e raté. */
async function playFullDay(userId: string): Promise<void> {
  await playGuess({ userId, guess: "faire" });
  await playGuess({ userId, guess: WRONG });
  await playGuess({ userId, guess: "temps" });
  for (let i = 0; i < 6; i++) await playGuess({ userId, guess: WRONG });
}

/** Rejette avec une TroisError de ce statut. */
async function expectTroisError(promise: Promise<unknown>, status: number): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(TroisError);
  await expect(promise).rejects.toMatchObject({ status });
}

beforeEach(async () => {
  await truncateTestDb();
  resetWordsCache();
  await db.user.createMany({
    data: [ME, OTHER].map((id) => ({ id, name: id, email: `${id}@example.test` })),
  });
});

describe("evaluate", () => {
  it("bien placé, mal placé, absent", () => {
    expect(evaluate("chose", "chose")).toEqual(Array(5).fill("correct"));
    expect(evaluate("monde", "temps")).toEqual([
      "present",
      "absent",
      "absent",
      "absent",
      "present",
    ]);
  });

  it("signale chaque occurrence d'une lettre en double", () => {
    // un seul N dans la réponse : le N bien placé est vert, les deux autres orange
    expect(evaluate("nonne", "noirs")).toEqual([
      "correct",
      "correct",
      "present",
      "present",
      "absent",
    ]);
    expect(evaluate("eeeee", "temps")).toEqual([
      "present",
      "correct",
      "present",
      "present",
      "present",
    ]);
    expect(evaluate("aabbb", "baaaa")).toEqual([
      "present",
      "correct",
      "present",
      "present",
      "present",
    ]);
  });
});

describe("mots du jour", () => {
  it("tire 3 mots différents de la liste, identiques pour tout le monde", async () => {
    const words = await wordsFor("2026-03-01");
    expect(new Set(words).size).toBe(3);
    for (const w of words) expect(solutions).toContain(w);
    resetWordsCache();
    expect(await wordsFor("2026-03-01")).toEqual(words);
  });

  it("deux tirages simultanés donnent les mêmes mots", async () => {
    const [a, b] = await Promise.all([wordsFor("2026-03-02"), wordsFor("2026-03-02")]);
    expect(a).toEqual(b);
    expect(await db.troisDailyWord.count()).toBe(3);
  });

  it("ne ressert pas un mot tant qu'il en reste de jamais sortis", async () => {
    // tous les mots sauf 3 sont déjà sortis : le tirage doit prendre ces 3 là
    const pool = solutions as string[];
    const left = pool.slice(0, 3);
    await db.troisDailyWord.createMany({
      data: pool.slice(3).map((word, i) => ({ date: `2025-01-${i}`, slot: 0, word })),
      skipDuplicates: true,
    });
    expect([...(await wordsFor("2026-03-03"))].sort()).toEqual([...left].sort());
  });
});

describe("partie", () => {
  beforeEach(() => setAnswers());

  it("valide le mot avant tout", async () => {
    await expectTroisError(playGuess({ userId: ME, guess: "abc" }), 400);
    await expectTroisError(playGuess({ userId: ME, guess: "zzzzz" }), 422);
    expect(await db.troisGuess.count()).toBe(0);
  });

  it("ignore accents et majuscules", async () => {
    const r = await playGuess({ userId: ME, guess: "FAÏRE" });
    expect(r.marks).toEqual(Array(5).fill("correct"));
  });

  it("joue les mots dans l'ordre et ne révèle une réponse qu'une fois le mot terminé", async () => {
    const first = await playGuess({ userId: ME, guess: WRONG });
    expect(first.slot).toBe(0);
    expect(first.day.words[0]).toMatchObject({ status: "playing", answer: undefined });

    const won = await playGuess({ userId: ME, guess: "faire" });
    expect(won.day.words[0]).toMatchObject({ status: "won", tries: 2, answer: "faire" });
    expect(won.day.words[1]?.answer).toBeUndefined();

    await expectTroisError(playGuess({ userId: ME, guess: "temps", slot: 2 }), 409);
    expect((await playGuess({ userId: ME, guess: "temps", slot: 1 })).slot).toBe(1);
  });

  it("perd le mot après 6 essais, puis refuse de rejouer une fois la journée finie", async () => {
    await playFullDay(ME);
    const { day } = await getToday(ME);
    expect(day.over).toBe(true);
    expect(day.words.map((w) => w.status)).toEqual(["won", "won", "lost"]);
    expect(day.words[2]?.answer).toBe("chose");
    await expectTroisError(playGuess({ userId: ME, guess: "chose" }), 409);
  });

  it("essais envoyés en même temps : jamais deux fois le même numéro d'essai", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => playGuess({ userId: ME, guess: WRONG })),
    );
    const accepted = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected");
    for (const r of rejected) expect(r.reason).toMatchObject({ status: 409 });

    // les essais acceptés sont numérotés 1, 2, 3… sans doublon ni trou
    const guesses = await db.troisGuess.findMany({ orderBy: { attempt: "asc" } });
    expect(guesses.map((g) => g.attempt)).toEqual(
      Array.from({ length: accepted }, (_, i) => i + 1),
    );
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("la journée terminée apparaît dans l'activité, avec le score mais sans lettres", async () => {
    await playFullDay(ME);
    const events = await listRecentEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ app: "trois", type: "day_completed", payload: { found: 2 } });
    const text = JSON.stringify(events);
    for (const word of [...ANSWERS, WRONG]) expect(text).not.toContain(word);
  });

  it("stats : jours joués, 3 sur 3 et répartition des essais", async () => {
    await playFullDay(ME);
    const { stats } = await getToday(ME);
    expect(stats).toMatchObject({ played: 1, wordsFound: 2, perfectDays: 0, streak: 1 });
    expect(stats.dist).toEqual([1, 1, 0, 0, 0, 0]);
  });
});

describe("mode test", () => {
  beforeEach(() => setAnswers());

  it("refusé tant que le mot n'est pas terminé pour de vrai", async () => {
    await expectTroisError(practiceGuess({ userId: ME, guess: "faire", slot: 0 }), 409);
  });

  it("évalue sans rien enregistrer une fois le mot terminé", async () => {
    await playGuess({ userId: ME, guess: "faire" });
    const before = await db.troisGuess.count();
    expect((await practiceGuess({ userId: ME, guess: WRONG, slot: 0 })).marks).toHaveLength(5);
    expect(await db.troisGuess.count()).toBe(before);
    await expectTroisError(practiceGuess({ userId: ME, guess: WRONG, slot: 7 }), 400);
  });
});

describe("classement", () => {
  beforeEach(() => setAnswers());

  it("montre les couleurs des autres, jamais leurs lettres ni leurs réponses", async () => {
    await playFullDay(OTHER);
    const { players } = await dayLeaderboard(ME);
    const other = players.find((p) => p.id === OTHER);
    expect(other?.today.words[0]?.marks[0]).toEqual(Array(5).fill("correct"));
    const text = JSON.stringify(players);
    for (const word of [...ANSWERS, WRONG]) expect(text).not.toContain(word);
  });

  it("m'inclut même si je n'ai pas encore joué, après ceux qui ont joué", async () => {
    await playGuess({ userId: OTHER, guess: "faire" });
    const { players } = await dayLeaderboard(ME);
    expect(players.map((p) => [p.id, p.me])).toEqual([
      [OTHER, false],
      [ME, true],
    ]);
  });

  it("semaine : 6 points en 1 essai, 5 en 2, 0 pour un mot raté", async () => {
    await playFullDay(ME);
    const { totals } = await periodLeaderboard(ME, "week");
    expect(totals.find((t) => t.me)).toMatchObject({ points: 11, found: 2, words: 3, days: 1 });
  });

  it("ex æquo : même rang, ordre par pseudo (pas « moi » d'abord), le suivant saute un rang", async () => {
    const THIRD = "user-third";
    await db.user.create({ data: { id: THIRD, name: THIRD, email: `${THIRD}@example.test` } });
    // OTHER et ME trouvent le 1er mot du premier coup, THIRD a seulement commencé
    await playGuess({ userId: OTHER, guess: "faire" });
    await playGuess({ userId: ME, guess: "faire" });
    await playGuess({ userId: THIRD, guess: WRONG });

    const { players } = await dayLeaderboard(ME);
    expect(players.map((p) => [p.id, p.rank])).toEqual([
      [ME, 1],
      [OTHER, 1],
      [THIRD, 3],
    ]);
    // vu par un autre joueur, le même ordre
    const seenByOther = await dayLeaderboard(OTHER);
    expect(seenByOther.players.map((p) => p.id)).toEqual([ME, OTHER, THIRD]);

    // semaine : 6 points chacun pour ME et OTHER (THIRD n'a aucun mot terminé, donc absent)
    const { totals } = await periodLeaderboard(ME, "week");
    expect(totals.map((t) => [t.id, t.rank, t.points])).toEqual([
      [ME, 1, 6],
      [OTHER, 1, 6],
    ]);
  });
});

describe("passage à minuit", () => {
  // samedi 31 octobre puis dimanche 1er novembre 2026 (heure d'hiver : minuit à Paris = 23 h UTC)
  const DAY1 = "2026-10-31";
  const DAY2 = "2026-11-01";
  const MIDNIGHT = parisMidnight(DAY2);
  const BEFORE = new Date(MIDNIGHT - 60_000);
  const IN_GRACE = new Date(MIDNIGHT + 10 * 60_000);
  const AFTER_GRACE = new Date(MIDNIGHT + 31 * 60_000);

  beforeEach(async () => {
    await db.troisDailyWord.createMany({
      data: [
        ...ANSWERS.map((word, slot) => ({ date: DAY1, slot, word })),
        ...["noter", "vitre", "plage"].map((word, slot) => ({ date: DAY2, slot, word })),
      ],
    });
  });

  it("minuit à Paris, heure d'hiver comme d'été", () => {
    expect(MIDNIGHT).toBe(Date.UTC(2026, 9, 31, 23));
    expect(parisMidnight("2026-07-01")).toBe(Date.UTC(2026, 5, 30, 22));
  });

  it("un essai pensé pour hier n'est jamais compté pour aujourd'hui", async () => {
    // OTHER n'avait pas commencé la journée d'hier : pas de délai de grâce, rien d'enregistré
    await expectTroisError(
      playGuess({ userId: OTHER, guess: "noter", date: DAY1 }, { now: IN_GRACE }),
      409,
    );
    expect(await db.troisGuess.count()).toBe(0);
    await expectTroisError(playGuess({ userId: OTHER, guess: "noter", date: "hier" }), 400);
  });

  it("délai de grâce : une journée commencée avant minuit se finit jusqu'à 00h30", async () => {
    const started = await playGuess({ userId: ME, guess: WRONG, date: DAY1 }, { now: BEFORE });
    expect(started.day.endsAt).toBe(MIDNIGHT);

    // après minuit, on retrouve la journée d'hier et on peut la jouer
    expect((await getToday(ME, { now: IN_GRACE })).day.date).toBe(DAY1);
    const won = await playGuess({ userId: ME, guess: "faire", date: DAY1 }, { now: IN_GRACE });
    expect(won.day).toMatchObject({ date: DAY1 });
    expect(won.day.words[0]).toMatchObject({ status: "won", tries: 2 });
    expect(await db.troisGame.count({ where: { date: DAY2 } })).toBe(0);

    // délai écoulé : la journée d'hier est close, place aux nouveaux mots
    await expectTroisError(
      playGuess({ userId: ME, guess: "temps", date: DAY1 }, { now: AFTER_GRACE }),
      409,
    );
    expect((await getToday(ME, { now: AFTER_GRACE })).day.date).toBe(DAY2);
  });

  it("passer aux nouveaux mots laisse tomber la journée d'hier", async () => {
    await playGuess({ userId: ME, guess: WRONG, date: DAY1 }, { now: BEFORE });
    expect((await getToday(ME, { today: true, now: IN_GRACE })).day.date).toBe(DAY2);
    await playGuess({ userId: ME, guess: "noter", date: DAY2 }, { now: IN_GRACE });

    // la nouvelle journée est commencée : celle d'hier n'est plus jouable
    expect((await getToday(ME, { now: IN_GRACE })).day.date).toBe(DAY2);
    await expectTroisError(
      playGuess({ userId: ME, guess: "faire", date: DAY1 }, { now: IN_GRACE }),
      409,
    );
  });

  it("une journée finie après minuit compte pour la veille (activité, série)", async () => {
    await playGuess({ userId: ME, guess: "faire", date: DAY1 }, { now: BEFORE });
    await playGuess({ userId: ME, guess: "temps", date: DAY1 }, { now: BEFORE });
    await playGuess({ userId: ME, guess: "chose", date: DAY1 }, { now: IN_GRACE });
    const events = await listRecentEvents();
    expect(events[0]).toMatchObject({ type: "day_completed", payload: { found: 3 } });
    const { stats } = await getToday(ME, { now: IN_GRACE });
    expect(stats).toMatchObject({ played: 1, perfectDays: 1, streak: 1 });
  });
});

describe("historique du classement", () => {
  const DAY1 = "2026-10-31";
  const DAY2 = "2026-11-01";
  const NOW = new Date(parisMidnight(DAY2) + 12 * 3_600_000);

  beforeEach(async () => {
    await db.troisDailyWord.createMany({
      data: [
        ...ANSWERS.map((word, slot) => ({ date: DAY1, slot, word })),
        ...["noter", "vitre", "plage"].map((word, slot) => ({ date: DAY2, slot, word })),
      ],
    });
    // OTHER a joué hier (1er mot du premier coup), ME aujourd'hui
    await playGuess(
      { userId: OTHER, guess: "faire" },
      { now: new Date(parisMidnight(DAY1) + 12 * 3_600_000) },
    );
    await playGuess({ userId: ME, guess: "noter" }, { now: NOW });
  });

  it("un jour passé : ses grilles, en couleurs seulement, et jusqu'où remonter", async () => {
    const board = await dayLeaderboard(ME, { date: DAY1, now: NOW });
    expect(board).toMatchObject({ date: DAY1, today: DAY2, first: DAY1 });
    expect(board.players.map((p) => [p.id, dayScoreOf(p.today)])).toEqual([
      [OTHER, 1],
      [ME, 0],
    ]);
    expect(JSON.stringify(board.players)).not.toContain("faire");

    // pas de classement dans le futur : on retombe sur aujourd'hui
    expect((await dayLeaderboard(ME, { date: "2027-01-01", now: NOW })).date).toBe(DAY2);
    await expectTroisError(dayLeaderboard(ME, { date: "31/10", now: NOW }), 400);
  });

  it("une semaine ou un mois passé : la période entière qui contient la date", async () => {
    const october = await periodLeaderboard(ME, "month", { date: "2026-10-15", now: NOW });
    expect(october).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(october.totals.map((t) => [t.id, t.points])).toEqual([
      [OTHER, 6],
      [ME, 0],
    ]);

    // semaine du lundi 26 octobre, en cours : jusqu'à aujourd'hui
    const week = await periodLeaderboard(ME, "week", { date: DAY1, now: NOW });
    expect(week).toMatchObject({ from: "2026-10-26", to: DAY2 });
  });
});

const dayScoreOf = (d: { words: { status: string }[] }) =>
  d.words.filter((w) => w.status === "won").length;
