"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  dayNumber,
  dayScore,
  periodStart,
  shiftDate,
  wordPoints,
  type Mark,
  type Period,
} from "../src/game";
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
  today: string;
  first: string;
};

const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );

/** Date du jour à Paris, en attendant celle du serveur. */
const parisToday = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format();

/** Premier jour de la période qui contient `date` (pour « jour » : le jour lui-même). */
const startOf = (period: Period, date: string) =>
  period === "day" ? date : periodStart(date, period);

/** Premier jour de la période suivante. */
function nextStart(period: Period, start: string): string {
  if (period === "day") return shiftDate(start, 1);
  if (period === "week") return shiftDate(start, 7);
  // le 28 + 4 jours tombe toujours dans le mois suivant
  return shiftDate(start.slice(0, 8) + "28", 4).slice(0, 8) + "01";
}

/** Nom de la période commençant le jour `start`, calculé tout de suite (sans attendre le serveur). */
function periodLabel(period: Period, start: string, today: string): string {
  if (period === "day") {
    const number = ` · #${dayNumber(start)}`;
    if (start === today) return `Aujourd'hui${number}`;
    if (start === shiftDate(today, -1)) return `Hier${number}`;
    return fmt(start, { weekday: "long", day: "numeric", month: "long" }) + number;
  }
  if (start === startOf(period, today)) return CURRENT[period];
  if (period === "month") return fmt(start, { month: "long", year: "numeric" });
  return `Semaine du ${fmt(start, { day: "numeric", month: "short" })}`;
}

const CURRENT: Record<Period, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois-ci",
};

const keyOf = (period: Period, date: string | null) => `${period}:${date ?? "now"}`;

export function Leaderboard({ players, reload }: { players: Player[] | null; reload: () => void }) {
  const [period, setPeriod] = useState<Period>("day");
  // premier jour de la période affichée dans l'historique ; null = la période en cours
  const [date, setDate] = useState<string | null>(null);
  // classements déjà chargés : une période passée ne change plus, on la garde pour revenir dessus
  // sans attendre ; la précédente est préchargée pour que la flèche ‹ réponde tout de suite
  const [boards, setBoards] = useState<Record<string, Board>>({});
  const loadedKeys = useRef(new Set<string>());
  // pendant le chargement d'une période pas encore en mémoire : on garde l'ancienne à l'écran
  const [stale, setStale] = useState<Board | null>(null);
  const [bounds, setBounds] = useState<{ today: string; first: string } | null>(null);

  const fetchBoard = useCallback(async (p: Period, d: string | null) => {
    const params = new URLSearchParams();
    if (p !== "day") params.set("period", p);
    if (d) params.set("date", d);
    try {
      const board = await api<Board>(`/api/trois/leaderboard?${params}`);
      loadedKeys.current.add(keyOf(p, d));
      setBoards((b) => ({ ...b, [keyOf(p, d)]: board }));
      setBounds((old) =>
        old?.today === board.today && old.first === board.first
          ? old
          : { today: board.today, first: board.first },
      );
    } catch {
      /* réessayé au prochain tour */
    }
  }, []);

  useEffect(() => {
    if (period === "day" && !date) reload();
    // historique déjà en mémoire : figé, rien à recharger
    if (date && loadedKeys.current.has(keyOf(period, date))) return;
    fetchBoard(period, date);
    if (date) return;
    // période en cours : rafraîchie, sans requête tant que l'onglet est caché
    const t = setInterval(
      () => document.visibilityState === "visible" && fetchBoard(period, null),
      60_000,
    );
    return () => clearInterval(t);
  }, [period, date, fetchBoard, reload]);

  const today = bounds?.today ?? parisToday();
  const currentStart = startOf(period, today);
  const shownStart = date ?? currentStart;
  const prevStart = startOf(period, shiftDate(shownStart, -1));
  const canPrev = !!bounds && shownStart > bounds.first;

  // précharge la période précédente
  useEffect(() => {
    if (!canPrev || loadedKeys.current.has(keyOf(period, prevStart))) return;
    fetchBoard(period, prevStart);
  }, [period, prevStart, canPrev, fetchBoard]);

  const loadedBoard = boards[keyOf(period, date)];
  const board = loadedBoard ?? stale;
  const loading = !loadedBoard;
  const current = PERIODS[period];
  const past = date !== null;
  // jour en cours : les grilles partagées avec le podium de gauche (rafraîchies par le parent)
  const shownPlayers =
    period === "day" ? ((!past ? players : null) ?? board?.players ?? null) : null;
  const totals = period === "day" ? null : (board?.totals ?? null);
  const loaded = period === "day" ? shownPlayers : totals;
  const label = periodLabel(period, shownStart, today);

  const go = (target: string | null) => {
    sfx.click();
    setStale(board);
    setDate(target);
  };
  const choosePeriod = (id: Period) => {
    sfx.click();
    setStale(null);
    setPeriod(id);
    setDate(null);
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
            onClick={() => choosePeriod(id)}
            className={`rounded-full px-4 py-1.5 ${period === id ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            {PERIODS[id].label}
          </button>
        ))}
      </div>

      {/* historique : jour, semaine ou mois précédent / suivant, et retour direct à aujourd'hui */}
      <div className="-mt-2 flex items-center justify-center gap-2 text-sm">
        <button
          onClick={() => go(prevStart)}
          disabled={!canPrev}
          aria-label="Période précédente"
          className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-zinc-300 hover:text-zinc-100 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="min-w-44 text-center first-letter:uppercase">{label}</span>
        <button
          onClick={() => {
            const next = nextStart(period, shownStart);
            go(next >= currentStart ? null : next);
          }}
          disabled={!past}
          aria-label="Période suivante"
          className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-zinc-300 hover:text-zinc-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      {/* place réservée même quand il est caché : rien ne saute à l'écran */}
      <button
        onClick={() => go(null)}
        disabled={!past}
        className={`-mt-3 self-center rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 ${past ? "" : "invisible"}`}
      >
        ⏭ Revenir à {CURRENT[period].toLowerCase()}
      </button>

      {/* sur très grand écran le podium du jour en cours est déjà affiché à gauche */}
      <div className={period === "day" && !past ? "xl:hidden" : ""}>
        <Podium
          title={past ? `Podium · ${label}` : current.title}
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
        <ol
          className={`flex flex-col gap-2 transition-opacity ${loading && loaded ? "opacity-50" : ""}`}
        >
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
