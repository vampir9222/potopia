"use client";

import { dayScore } from "../src/game";
import type { Player, Total } from "./Leaderboard";

/** `rank` : rang serveur (ex æquo = même rang), d'où la médaille. */
export type PodiumEntry = { id: string; name: string; me: boolean; rank: number; detail: string };

/** Les joueurs du jour qui ont commencé, déjà triés et classés par le serveur. */
export const dayEntries = (players: Player[] | null) =>
  players &&
  players
    .filter((p) => dayScore(p.today).started)
    .map((p) => {
      const s = dayScore(p.today);
      return { ...p, detail: `${s.found}/3 · ${s.tries} ess.` };
    });

/** Les joueurs de la semaine ou du mois qui ont marqué des points. */
export const totalEntries = (totals: Total[] | null) =>
  totals && totals.filter((t) => t.points > 0).map((t) => ({ ...t, detail: `${t.points} pts` }));

const MEDALS = ["🥇", "🥈", "🥉"];
// marche du podium par position d'affichage (2 · 1 · 3)
const PLACES = [
  { place: 2, height: "h-16", color: "bg-zinc-400/80" },
  { place: 1, height: "h-24", color: "bg-amber-400/90" },
  { place: 3, height: "h-12", color: "bg-orange-700/80" },
];

/**
 * Les 3 premiers, en 2 · 1 · 3. La médaille et le numéro suivent le rang serveur : deux ex æquo
 * en tête ont tous les deux 🥇 et le suivant 🥉.
 */
export function Podium({
  entries,
  title = "Podium du jour",
}: {
  entries: PodiumEntry[] | null;
  title?: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-center text-xs font-semibold tracking-wide text-zinc-400 uppercase">
        {title}
      </h2>
      {!entries ? (
        <p className="mt-6 text-center text-sm text-zinc-400">Chargement…</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-400">
          Le podium est vide pour l&apos;instant. À toi l&apos;or !
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 items-end gap-2">
          {PLACES.map(({ place, height, color }) => {
            const e = entries[place - 1];
            const rank = e?.rank ?? place;
            const medal = MEDALS[rank - 1] ?? MEDALS[place - 1];
            return (
              <div key={place} className="flex min-w-0 flex-col items-center">
                {e ? (
                  <>
                    <span className={`text-2xl ${rank === 1 ? "animate-pop" : ""}`}>{medal}</span>
                    <p
                      className={`w-full truncate text-center text-sm font-semibold ${e.me ? "text-good" : ""}`}
                      title={e.name}
                    >
                      {e.name}
                    </p>
                    <p className="text-[11px] text-zinc-400">{e.detail}</p>
                  </>
                ) : (
                  <span className="text-2xl opacity-20">{medal}</span>
                )}
                <div
                  className={`mt-1 grid w-full place-items-center rounded-t-lg font-black text-zinc-900 ${height} ${color}`}
                >
                  {rank}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
