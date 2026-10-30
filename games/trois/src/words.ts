import { randomInt } from "node:crypto";
import { db } from "@app/db";
import solutions from "../data/solutions.json";
import { WORDS_PER_DAY } from "./game";

const POOL = solutions as string[];

/** Date du jour à Paris, au format YYYY-MM-DD */
export function todayParis(now = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(now);
}

/** Instant (ms) où commence une date à Paris : minuit, à 22 h ou 23 h UTC la veille selon la saison. */
export function parisMidnight(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  for (const hours of [2, 1]) {
    const t = utc - hours * 3_600_000;
    if (todayParis(new Date(t)) === date) return t;
  }
  return utc;
}

export { dayNumber } from "./game";

// Les mots d'une date ne changent plus une fois tirés : on les garde en mémoire.
const cache = new Map<string, string[]>();

/** Tests uniquement : oublie les mots en mémoire (la base de test est vidée entre les tests). */
export function resetWordsCache(): void {
  cache.clear();
}

/**
 * Les 3 mots du jour, identiques pour tout le monde.
 * Tirés au hasard (crypto) le premier jour où quelqu'un joue, puis enregistrés en base.
 * On pioche d'abord parmi les mots jamais sortis ; quand la liste est épuisée,
 * parmi ceux sortis il y a le plus longtemps.
 */
export async function wordsFor(date: string): Promise<string[]> {
  const hit = cache.get(date);
  if (hit) return hit;

  let rows = await db.troisDailyWord.findMany({ where: { date }, orderBy: { slot: "asc" } });
  if (rows.length < WORDS_PER_DAY) {
    const used = await db.troisDailyWord.groupBy({
      by: ["word"],
      _max: { date: true },
      where: { date: { lt: date } },
    });
    const lastUsed = new Map(used.map((u) => [u.word, u._max.date ?? ""]));
    const fresh = POOL.filter((w) => !lastUsed.has(w));
    const candidates =
      fresh.length >= WORDS_PER_DAY
        ? fresh
        : // liste épuisée : la moitié la plus anciennement sortie
          [...POOL]
            .sort((a, b) => (lastUsed.get(a) ?? "").localeCompare(lastUsed.get(b) ?? ""))
            .slice(0, POOL.length / 2);

    const picked: string[] = [];
    while (picked.length < WORDS_PER_DAY) {
      const w = candidates[randomInt(candidates.length)];
      if (w && !picked.includes(w)) picked.push(w);
    }
    // si deux requêtes tirent en même temps à minuit, la première gagne (clé primaire date+slot)
    await db.troisDailyWord.createMany({
      data: picked.map((word, slot) => ({ date, slot, word })),
      skipDuplicates: true,
    });
    rows = await db.troisDailyWord.findMany({ where: { date }, orderBy: { slot: "asc" } });
  }

  const words = rows.map((r) => r.word);
  cache.set(date, words);
  return words;
}

/** Combien de jours avant de devoir resservir un mot déjà sorti. */
export async function daysLeft() {
  const used = await db.troisDailyWord.findMany({ distinct: ["word"], select: { word: true } });
  const usedSet = new Set(used.map((u) => u.word));
  return Math.floor(POOL.filter((w) => !usedSet.has(w)).length / WORDS_PER_DAY);
}
