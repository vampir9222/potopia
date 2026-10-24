import { getUsersByIds } from "@app/core";
import { db } from "@app/db";
import type { Duo, Period, Who } from "./game";

const LIMIT = 100;

/** Début du mois à Paris (heure d'hiver : l'été, une heure d'écart sans importance ici). */
export function monthStart(now = new Date()): Date {
  const [y = "2026", m = "01"] = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" })
    .format(now)
    .split("-");
  return new Date(`${y}-${m}-01T00:00:00+01:00`);
}

/** Meilleure victoire d'abord (moins de tours, puis moins de témoins), puis le plus de victoires. */
function compareDuos(a: Duo, b: Duo): number {
  if (a.best && !b.best) return -1;
  if (!a.best && b.best) return 1;
  if (a.best && b.best) {
    const d = a.best.turns - b.best.turns || a.best.mistakes - b.best.mistakes;
    if (d) return d;
  }
  return b.wins - a.wins || a.played - b.played;
}

/**
 * Classement des duos : une ligne par paire de joueurs, quel que soit celui qui a lancé la partie.
 * Seules les parties gagnées ou perdues comptent (pas les abandons).
 */
export async function duoLeaderboard(
  meId: string,
  period: Period,
): Promise<{ duos: Duo[]; total: number }> {
  const games = await db.agentsGame.findMany({
    where: {
      status: { in: ["WON", "LOST"] },
      ...(period === "month" ? { finishedAt: { gte: monthStart() } } : {}),
    },
    select: { userA: true, userB: true, status: true, turnsUsed: true, mistakes: true },
  });

  const pairs = new Map<
    string,
    { ids: [string, string]; played: number; wins: number; best: Duo["best"] }
  >();
  for (const g of games) {
    const ids = [g.userA, g.userB].sort() as [string, string];
    const key = ids.join("|");
    const p = pairs.get(key) ?? { ids, played: 0, wins: 0, best: null };
    p.played++;
    if (g.status === "WON" && g.turnsUsed !== null) {
      p.wins++;
      const score = { turns: g.turnsUsed, mistakes: g.mistakes };
      if (
        !p.best ||
        score.turns < p.best.turns ||
        (score.turns === p.best.turns && score.mistakes < p.best.mistakes)
      ) {
        p.best = score;
      }
    }
    pairs.set(key, p);
  }

  const users = await getUsersByIds([...pairs.values()].flatMap((p) => p.ids));
  const names = new Map<string, Who>(
    users.map((u) => [u.id, { id: u.id, name: u.name, image: u.image }]),
  );
  const whoOf = (id: string): Who => names.get(id) ?? { id, name: "Membre inconnu", image: null };

  const duos: Duo[] = [...pairs.values()].map((p) => ({
    players: [whoOf(p.ids[0]), whoOf(p.ids[1])],
    me: p.ids.includes(meId),
    played: p.played,
    wins: p.wins,
    best: p.best,
  }));
  duos.sort(compareDuos);
  return { duos: duos.slice(0, LIMIT), total: duos.length };
}
