"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { dayScore, shiftDate, wordPoints, type Mark, type Period } from "../src/game";
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

/** Réponse de /api/trois/leaderboard : un jour, ou une semaine / un mois. */
type Board = {
  players?: Player[];
  totals?: Total[];
  date?: string;
  number?: number;
  from?: string;
  to?: string;
  today: string;
  first: string;
};

const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );

/** Nom de la période affichée dans l'historique (`null` : la période en cours). */
function periodLabel(period: Period, board: Board | null, past: boolean): string {
  if (period === "day") {
    const number = board?.number ? ` · #${board.number}` : "";
    if (!past || !board?.date) return `Aujourd'hui${number}`;
    if (board.date === shiftDate(board.today, -1)) return `Hier${number}`;
    return fmt(board.date, { weekday: "long", day: "numeric", month: "long" }) + number;
  }
  if (!past || !board?.from) return period === "week" ? "Cette semaine" : "Ce mois-ci";
  if (period === "month") return fmt(board.from, { month: "long", year: "numeric" });
  return `Semaine du ${fmt(board.from, { day: "numeric", month: "short" })}`;
}

export function Leaderboard({ players, reload }: { players: Player[] | null; reload: () => void }) {
  const [period, setPeriod] = useState<Period>("day");
  // jour affiché dans l'historique (pour une semaine ou un mois : un jour de la période) ;
  // null = la période en cours, rafraîchie régulièrement
  const [date, setDate] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);

  const loadBoard = useCallback(async () => {
    const params = new URLSearchParams();
    if (period !== "day") params.set("period", period);
    if (date) params.set("date", date);
    try {
      setBoard(await api(`/api/trois/leaderboard?${params}`));
    } catch {
      /* réessayé au prochain tour */
    }
  }, [period, date]);

  useEffect(() => {
    setBoard(null);
    loadBoard();
    if (period === "day" && !date) reload();
    // historique : figé ; période en cours : rafraîchie, sans requête tant que l'onglet est caché
    if (date) return;
    const t = setInterval(() => document.visibilityState === "visible" && loadBoard(), 60_000);
    return () => clearInterval(t);
  }, [period, date, loadBoard, reload]);

  const current = PERIODS[period];
  const past = date !== null;
  // jour en cours : les grilles partagées avec le podium de gauche (rafraîchies par le parent)
  const dayPlayers = period === "day" && !past ? (players ?? board?.players ?? null) : null;
  const shownPlayers = period === "day" ? (dayPlayers ?? board?.players ?? null) : null;
  const totals = period === "day" ? null : (board?.totals ?? null);
  const loaded = period === "day" ? shownPlayers : totals;

  // bornes de l'historique : du premier jour joué à aujourd'hui
  const start = period === "day" ? board?.date : board?.from;
  const end = period === "day" ? board?.date : board?.to;
  const canPrev = !!board && !!start && start > board.first;
  const canNext = past && !!board && !!end && end < board.today;
  const go = (target: string | null) => {
    sfx.click();
    setDate(target && board && target < board.today ? target : null);
  };
  // rang calculé par le serveur : les ex æquo partagent la médaille
  const medal = (rank: number) => MEDALS[rank - 1] ?? rank;

  const row = (w: Who, rankLabel: ReactNode, sub: ReactNode, right?: ReactNode) => (
    <li
      key={w.id}
      className={`flex items-center gap-3 rounded-xl border p-3 ${w.me ? "border-zinc-600 bg-zinc-900" : "border-zinc-800"}`}
    >
      <span className="w-7 text-center font-mono text-zinc-400">{rankLabel}</span>
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
          {w.me && <span className="ml-1 text-xs text-zinc-400">(toi)</span>}
        </p>
        <p className="text-xs text-zinc-400">{sub}</p>
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
              setDate(null);
            }}
            className={`rounded-full px-4 py-1.5 ${period === id ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            {PERIODS[id].label}
          </button>
        ))}
      </div>

      {/* historique : jour, semaine ou mois précédent / suivant */}
      <div className="-mt-2 flex items-center justify-center gap-2 text-sm">
        <button
          onClick={() => start && go(shiftDate(start, -1))}
          disabled={!canPrev}
          aria-label="Période précédente"
          className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-zinc-300 hover:text-zinc-100 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="min-w-44 text-center first-letter:uppercase">
          {periodLabel(period, board, past)}
        </span>
        <button
          onClick={() => end && go(shiftDate(end, 1))}
          disabled={!canNext}
          aria-label="Période suivante"
          className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-zinc-300 hover:text-zinc-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {/* sur très grand écran le podium du jour en cours est déjà affiché à gauche */}
      <div className={period === "day" && !past ? "xl:hidden" : ""}>
        <Podium
          title={past ? `Podium · ${periodLabel(period, board, past)}` : current.title}
          entries={period === "day" ? dayEntries(shownPlayers) : totalEntries(totals)}
        />
      </div>

      <section>
        <h2 className="mb-2 font-bold">{past ? "Classement" : current.heading}</h2>
        {period !== "day" && (
          <p className="mb-2 text-xs text-zinc-400">
            Mot trouvé : {wordPoints(1)} points en 1 essai, un de moins par essai, {wordPoints(6)}{" "}
            en 6. Raté : 0.
          </p>
        )}
        {!loaded && <p className="text-zinc-400">Chargement…</p>}
        {loaded && loaded.length <= 1 && (
          <p className="mb-3 text-sm text-zinc-400">
            {past ? "Personne d'autre n'a joué." : "Personne d'autre n'a joué pour l'instant."}
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {period === "day"
            ? (shownPlayers ?? []).map((p) => {
                const s = dayScore(p.today);
                return row(
                  p,
                  !s.started ? "–" : medal(p.rank),
                  <>
                    {!s.started
                      ? past
                        ? "Pas joué"
                        : "Pas encore joué"
                      : `${s.found}/3 trouvés · ${s.tries} essais${p.today.over ? "" : past ? " · pas fini" : " · en cours"}`}
                    {/* série : celle d'aujourd'hui, sans rapport avec un jour passé */}
                    {!past && p.streak > 1 && ` · 🔥 ${p.streak}`}
                  </>,
                  <div className="flex gap-1.5">
                    {p.today.words.map((w, wi) => (
                      <MiniGrid key={wi} marks={w.marks} status={w.status} />
                    ))}
                  </div>,
                );
              })
            : (totals ?? []).map((t) =>
                row(
                  t,
                  t.points === 0 ? "–" : medal(t.rank),
                  t.days === 0
                    ? past
                      ? "Pas joué"
                      : "Pas encore joué"
                    : `${t.found}/${t.words} mots trouvés · ${t.days} jour${t.days > 1 ? "s" : ""}`,
                  <span className="font-mono text-lg font-bold">
                    {t.points}
                    <span className="ml-0.5 text-xs font-normal text-zinc-400">pts</span>
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
