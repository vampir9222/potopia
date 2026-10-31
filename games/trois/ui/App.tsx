"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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

export function TroisApp({
  me,
  belowPodium,
}: {
  me: Me;
  /** Affiché sous le podium de la colonne de gauche (la mascotte du portail). */
  belowPodium?: ReactNode;
}) {
  const [day, setDay] = useState<DayView | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("jeu");
  const [players, setPlayers] = useState<Player[] | null>(null);
  const muted = useMuted();

  // `today` : laisser tomber la journée d'hier (délai de grâce) pour les nouveaux mots ; le choix
  // tient pour les rechargements suivants (retour sur l'onglet, nouveau jour)
  const skipGrace = useRef(false);
  const load = useCallback(async (today = false) => {
    if (today) skipGrace.current = true;
    try {
      const r = await api(skipGrace.current ? "/api/trois/game?today=1" : "/api/trois/game");
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
    // pas de requête tant que l'onglet est caché
    const t = setInterval(() => document.visibilityState === "visible" && loadPlayers(), 30_000);
    return () => clearInterval(t);
  }, [loadPlayers]);

  // nouveau jour à minuit : on recharge quand l'onglet redevient visible
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  // la journée affichée a changé : le classement du jour aussi
  const shownDate = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (day && shownDate.current && shownDate.current !== day.date) loadPlayers();
    shownDate.current = day?.date;
  }, [day, loadPlayers]);

  return (
    <div className="trois flex justify-center gap-6">
      <Boobzilla />

      {/* très grand écran : podium à gauche du jeu */}
      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="sticky top-20 flex flex-col items-center gap-6">
          <div className="w-full">
            <Podium entries={dayEntries(players)} />
          </div>
          {belowPodium}
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

        {/* pas de <main> : le layout du portail en a déjà un */}
        <section className="flex min-h-128 flex-1 flex-col">
          {error && !day && (
            <p className="m-auto p-4 text-center text-zinc-400">
              Impossible de charger la partie.{" "}
              <button
                onClick={() => load()}
                className="text-good underline-offset-4 hover:underline"
              >
                Réessayer
              </button>
            </p>
          )}
          {!error && !day && <p className="m-auto text-zinc-400">Chargement…</p>}
          {tab === "jeu" && day && (
            // nouvelle journée = nouveau composant : mot affiché, saisie et mode test repartent de zéro
            <Game
              key={day.date}
              day={day}
              onUpdate={(d, s) => {
                setDay(d);
                if (s) setStats(s);
                loadPlayers();
              }}
              onNewDay={load}
              onSkipToToday={() => load(true)}
              onShowLeaderboard={() => setTab("classement")}
            />
          )}
          {tab === "classement" && day && <Leaderboard players={players} reload={loadPlayers} />}
          {tab === "profil" && stats && <Profile me={me} stats={stats} />}
        </section>
      </div>
    </div>
  );
}
