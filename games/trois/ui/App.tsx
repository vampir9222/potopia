"use client";

import { useCallback, useEffect, useState } from "react";
import type { DayView } from "../src/game";
import { api } from "./api";
import { Boobzilla } from "./Boobzilla";
import { Game } from "./Game";
import { Leaderboard, type Player } from "./Leaderboard";
import { dayEntries, Podium } from "./Podium";
import { Profile, type Stats } from "./Profile";
import { setMuted, sfx, useMuted } from "./sound";

/** Le joueur connecté au portail (compte Discord). */
export type Me = { name: string; image: string | null };
type Tab = "jeu" | "classement" | "profil";

export function TroisApp({ me }: { me: Me }) {
  const [day, setDay] = useState<DayView | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("jeu");
  const [players, setPlayers] = useState<Player[] | null>(null);
  const muted = useMuted();

  const load = useCallback(async () => {
    try {
      const r = await api("/api/trois/game");
      setDay(r.day);
      setStats(r.stats);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // classement partagé entre le podium et l'onglet Classement
  const loadPlayers = useCallback(async () => {
    try {
      setPlayers((await api("/api/trois/leaderboard")).players);
    } catch {
      /* réessayé au prochain tour */
    }
  }, []);

  useEffect(() => {
    loadPlayers();
    const t = setInterval(loadPlayers, 30_000);
    return () => clearInterval(t);
  }, [loadPlayers]);

  // nouveau jour à minuit : on recharge quand l'onglet redevient visible
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  return (
    <div className="trois flex justify-center gap-6">
      <Boobzilla />

      {/* très grand écran : podium à gauche du jeu */}
      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="sticky top-20">
          <Podium entries={dayEntries(players)} />
        </div>
      </aside>

      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-zinc-800 bg-[#0c0c10]">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h1 className="text-2xl font-black tracking-[0.2em]">
            TROI<span className="text-good">S</span>
          </h1>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1 rounded-full bg-zinc-900 p-1">
              {(["jeu", "classement", "profil"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    sfx.click();
                    setTab(t);
                  }}
                  className={`rounded-full px-2.5 py-1.5 text-xs capitalize transition sm:px-3 sm:text-sm ${
                    tab === t
                      ? "bg-zinc-100 font-semibold text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
            <button
              onClick={() => {
                setMuted(!muted);
                if (muted) sfx.click();
              }}
              title={muted ? "Activer les sons" : "Couper les sons"}
              className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-sm text-zinc-400 hover:text-zinc-100"
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </header>

        <main className="flex min-h-128 flex-1 flex-col">
          {error && !day && (
            <p className="m-auto p-4 text-center text-zinc-400">
              Impossible de charger la partie.{" "}
              <button onClick={load} className="text-good underline-offset-4 hover:underline">
                Réessayer
              </button>
            </p>
          )}
          {!error && !day && <p className="m-auto text-zinc-500">Chargement…</p>}
          {tab === "jeu" && day && (
            <Game
              day={day}
              onUpdate={(d, s) => {
                setDay(d);
                if (s) setStats(s);
                loadPlayers();
              }}
              onShowLeaderboard={() => setTab("classement")}
            />
          )}
          {tab === "classement" && day && <Leaderboard players={players} reload={loadPlayers} />}
          {tab === "profil" && stats && <Profile me={me} stats={stats} />}
        </main>
      </div>
    </div>
  );
}
