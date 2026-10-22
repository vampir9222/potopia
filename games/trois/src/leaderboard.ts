import { getUsersByIds } from "@app/core";
import { db } from "@app/db";
import { dayView, streaksFor } from "./day";
import { compareDays, wordPoints, type DayView, type Period } from "./game";
import { todayParis } from "./words";

/** Un joueur tel que le classement l'affiche : pseudo et avatar Discord du portail. */
type Who = { id: string; name: string; image: string | null; me: boolean };
export type Player = Who & { streak: number; today: DayView };
export type Total = Who & { points: number; found: number; words: number; days: number };

const LIMIT = 200;

/** Premier jour de la période (lundi pour la semaine, le 1er pour le mois). */
function periodStart(today: string, period: Exclude<Period, "day">): string {
  if (period === "month") return today.slice(0, 8) + "01";
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Garde les LIMIT premiers, plus ma ligne si elle est au-delà. */
function top<T extends { me: boolean }>(rows: T[]): T[] {
  const shown = rows.slice(0, LIMIT);
  const mine = rows.findIndex((r) => r.me);
  const row = rows[mine];
  if (mine >= LIMIT && row) shown.push(row);
  return shown;
}

async function identities(ids: string[], meId: string): Promise<Map<string, Who>> {
  const users = await getUsersByIds(ids);
  return new Map(
    users.map((u) => [u.id, { id: u.id, name: u.name, image: u.image, me: u.id === meId }]),
  );
}

/**
 * Classement du jour : grilles de tous ceux qui ont joué, plus moi. Couleurs uniquement, jamais
 * les lettres (dayView sans `withLetters`).
 */
export async function dayLeaderboard(meId: string): Promise<{ players: Player[]; total: number }> {
  const date = todayParis();
  const games = await db.troisGame.findMany({
    where: { date, guesses: { some: {} } },
    select: {
      userId: true,
      slot: true,
      status: true,
      guesses: { select: { word: true, marks: true }, orderBy: { attempt: "asc" } },
    },
  });
  const userIds = [...new Set([meId, ...games.map((g) => g.userId)])];
  const [who, streaks] = await Promise.all([identities(userIds, meId), streaksFor(userIds)]);

  const rows: Player[] = [];
  for (const id of userIds) {
    const user = who.get(id);
    if (!user) continue;
    rows.push({
      ...user,
      today: await dayView(
        date,
        games.filter((g) => g.userId === id),
        { withLetters: false },
      ),
      streak: streaks.get(id) ?? 0,
    });
  }
  rows.sort((a, b) => compareDays(a.today, b.today));
  return { players: top(rows), total: rows.length };
}

/** Semaine ou mois : cumul des points des mots terminés. */
export async function periodLeaderboard(
  meId: string,
  period: "week" | "month",
): Promise<{ totals: Total[]; from: string; to: string; total: number }> {
  const today = todayParis();
  const from = periodStart(today, period);
  const games = await db.troisGame.findMany({
    where: { date: { gte: from, lte: today }, status: { not: "PLAYING" } },
    select: { userId: true, date: true, status: true, _count: { select: { guesses: true } } },
  });
  const userIds = [...new Set([meId, ...games.map((g) => g.userId)])];
  const who = await identities(userIds, meId);

  const acc = new Map(
    userIds.map((id) => [id, { points: 0, found: 0, words: 0, days: new Set<string>() }]),
  );
  for (const g of games) {
    const a = acc.get(g.userId);
    if (!a) continue;
    a.words++;
    a.days.add(g.date);
    if (g.status === "WON") {
      a.found++;
      a.points += wordPoints(g._count.guesses);
    }
  }

  const rows: Total[] = [];
  for (const [id, a] of acc) {
    const user = who.get(id);
    if (!user) continue;
    rows.push({ ...user, points: a.points, found: a.found, words: a.words, days: a.days.size });
  }
  rows.sort((a, b) => b.points - a.points || b.found - a.found || a.days - b.days);
  return { totals: top(rows), from, to: today, total: rows.length };
}
