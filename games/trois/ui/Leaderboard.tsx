"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { dayScore, wordPoints, type Mark, type Period } from "../src/game";
import type { Player, Total } from "../src/leaderboard";
import { api } from "./api";
import { dayEntries, Podium, totalEntries } from "./Podium";
import { sfx } from "./sound";

export type { Player, Total };
type Who = { id: string; name: string; image: string | null; me: boolean };

const DOT: Record<Mark, string> = { correct: "bg-good", present: "bg-near", absent: "bg-zinc-700" };
const MEDALS = ["🥇", "🥈", "🥉"];
const PERIODS: Record<Period, { label: string; title: string; heading: string }> = {
  day: { label: "Jour", title: "Podium du jour", heading: "Classement du jour" },
  week: { label: "Semaine", title: "Podium de la semaine", heading: "Classement de la semaine" },
  month: { label: "Mois", title: "Podium du mois", heading: "Classement du mois" },
};
const PERIOD_ORDER: Period[] = ["day", "week", "month"];

export function Leaderboard({ players, reload }: { players: Player[] | null; reload: () => void }) {
  const [period, setPeriod] = useState<Period>("day");
  const [totals, setTotals] = useState<Total[] | null>(null);

  const loadTotals = useCallback(async () => {
    if (period === "day") return;
    try {
      setTotals((await api(`/api/trois/leaderboard?period=${period}`)).totals);
    } catch {
      /* réessayé au prochain tour */
    }
  }, [period]);

  useEffect(() => {
    setTotals(null);
    if (period === "day") {
      reload();
      return;
    }
    loadTotals();
    const t = setInterval(loadTotals, 60_000);
    return () => clearInterval(t);
  }, [period, loadTotals, reload]);

  const current = PERIODS[period];
  const loaded = period === "day" ? players : totals;
  const ranked = <T,>(rows: T[] | null) => (rows ?? []).map((x, i) => ({ ...x, rank: i + 1 }));

  const row = (w: Who, rankLabel: ReactNode, sub: ReactNode, right?: ReactNode) => (
    <li
      key={w.id}
      className={`flex items-center gap-3 rounded-xl border p-3 ${w.me ? "border-zinc-600 bg-zinc-900" : "border-zinc-800"}`}
    >
      <span className="w-7 text-center font-mono text-zinc-500">{rankLabel}</span>
      {w.image ? (
        <img src={w.image} alt="" width={28} height={28} className="shrink-0 rounded-full" />
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-800 text-xs text-zinc-400">
          {w.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {w.name}
          {w.me && <span className="ml-1 text-xs text-zinc-500">(toi)</span>}
        </p>
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
      {right}
    </li>
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex gap-1 self-center rounded-full bg-zinc-900 p-1 text-sm">
        {PERIOD_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => {
              sfx.click();
              setPeriod(id);
            }}
            className={`rounded-full px-4 py-1.5 ${period === id ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            {PERIODS[id].label}
          </button>
        ))}
      </div>

      {/* sur très grand écran le podium du jour est déjà affiché à gauche */}
      <div className={period === "day" ? "xl:hidden" : ""}>
        <Podium
          title={current.title}
          entries={period === "day" ? dayEntries(players) : totalEntries(totals)}
        />
      </div>

      <section>
        <h2 className="mb-2 font-bold">{current.heading}</h2>
        {period !== "day" && (
          <p className="mb-2 text-xs text-zinc-500">
            Mot trouvé : {wordPoints(1)} points en 1 essai, un de moins par essai, {wordPoints(6)}{" "}
            en 6. Raté : 0.
          </p>
        )}
        {!loaded && <p className="text-zinc-500">Chargement…</p>}
        {loaded && loaded.length <= 1 && (
          <p className="mb-3 text-sm text-zinc-500">
            Personne d&apos;autre n&apos;a joué pour l&apos;instant.
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {period === "day"
            ? ranked(players).map((p) => {
                const s = dayScore(p.today);
                return row(
                  p,
                  !s.started ? "–" : (MEDALS[p.rank - 1] ?? p.rank),
                  <>
                    {!s.started
                      ? "Pas encore joué"
                      : `${s.found}/3 trouvés · ${s.tries} essais${p.today.over ? "" : " · en cours"}`}
                    {p.streak > 1 && ` · 🔥 ${p.streak}`}
                  </>,
                  <div className="flex gap-1.5">
                    {p.today.words.map((w, wi) => (
                      <MiniGrid key={wi} marks={w.marks} status={w.status} />
                    ))}
                  </div>,
                );
              })
            : ranked(totals).map((t) =>
                row(
                  t,
                  t.points === 0 ? "–" : (MEDALS[t.rank - 1] ?? t.rank),
                  t.days === 0
                    ? "Pas encore joué"
                    : `${t.found}/${t.words} mots trouvés · ${t.days} jour${t.days > 1 ? "s" : ""}`,
                  <span className="font-mono text-lg font-bold">
                    {t.points}
                    <span className="ml-0.5 text-xs font-normal text-zinc-500">pts</span>
                  </span>,
                ),
              )}
        </ol>
      </section>
    </div>
  );
}

function MiniGrid({ marks, status }: { marks: Mark[][]; status: string }) {
  return (
    <div
      className={`grid h-[38px] grid-rows-6 gap-px rounded-sm p-px ${
        status === "won" ? "ring-good/60 ring-1" : status === "lost" ? "ring-1 ring-red-500/60" : ""
      }`}
    >
      {Array.from({ length: 6 }, (_, r) => (
        <div key={r} className="flex gap-px">
          {Array.from({ length: 5 }, (_, c) => {
            const mark = marks[r]?.[c];
            return (
              <div key={c} className={`h-[5px] w-[5px] ${mark ? DOT[mark] : "bg-zinc-800/60"}`} />
            );
          })}
        </div>
      ))}
    </div>
  );
}
