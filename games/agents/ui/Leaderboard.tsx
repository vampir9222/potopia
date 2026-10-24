"use client";

import { Avatar, cx } from "@app/ui";
import { useEffect, useState } from "react";
import { TURNS, type Duo, type Period } from "../src/game";
import { api } from "./api";

const MEDALS = ["🥇", "🥈", "🥉"];
const PERIODS: Record<Period, string> = { month: "Ce mois-ci", all: "Depuis le début" };

/** Classement des duos : meilleure mission réussie, puis victoires. */
export function DuoLeaderboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [duos, setDuos] = useState<Duo[] | null>(null);

  useEffect(() => {
    let live = true;
    setDuos(null);
    api<{ duos: Duo[] }>(`/api/agents/leaderboard?period=${period}`)
      .then((r) => live && setDuos(r.duos))
      .catch(() => live && setDuos([]));
    return () => {
      live = false;
    };
  }, [period]);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-hover flex w-fit gap-1 rounded-full p-1 text-xs">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cx(
              "rounded-full px-3 py-1",
              period === p
                ? "bg-accent text-on-accent font-semibold"
                : "text-muted hover:text-text",
            )}
          >
            {PERIODS[p]}
          </button>
        ))}
      </div>
      {duos === null && <p className="text-muted text-sm">Chargement…</p>}
      {duos?.length === 0 && (
        <p className="text-muted text-sm">Aucune mission terminée pour l'instant.</p>
      )}
      <ol className="flex flex-col gap-2">
        {duos?.map((d, i) => (
          <li
            key={d.players.map((p) => p.id).join("|")}
            className={cx(
              "flex items-center gap-3 rounded-lg border p-2.5 text-sm",
              d.me ? "border-accent/60 bg-accent/5" : "border-border",
            )}
          >
            <span className="text-muted w-7 text-center font-mono">{MEDALS[i] ?? i + 1}</span>
            <span className="flex -space-x-2">
              <Avatar name={d.players[0].name} src={d.players[0].image} size={26} />
              <Avatar name={d.players[1].name} src={d.players[1].image} size={26} />
            </span>
            <span className="text-text min-w-0 flex-1 truncate">
              {d.players[0].name} & {d.players[1].name}
            </span>
            <span className="text-right text-xs">
              <span className="text-text block font-semibold">
                {d.best ? (d.best.turns > TURNS ? "mort subite" : `${d.best.turns} tours`) : "—"}
                {d.best && (
                  <span className="text-muted font-normal">
                    {" "}
                    · {d.best.mistakes} témoin{d.best.mistakes > 1 ? "s" : ""}
                  </span>
                )}
              </span>
              <span className="text-muted">
                {d.wins}/{d.played} réussie{d.wins > 1 ? "s" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
