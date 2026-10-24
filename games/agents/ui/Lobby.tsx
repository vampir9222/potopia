"use client";

import { Avatar, Badge, Card, Input, cx } from "@app/ui";
import { useCallback, useEffect, useState } from "react";
import { AGENTS_TOTAL, NAME, TURNS, type LobbyGame, type Who } from "../src/game";
import { api } from "./api";
import { DuoLeaderboard } from "./Leaderboard";
import { Rules } from "./Rules";

const POLL_MS = 20_000;

function statusOf(g: LobbyGame): {
  label: string;
  tone: "accent" | "neutral" | "success" | "danger";
} {
  if (g.status === "playing")
    return g.myTurn ? { label: "À toi", tone: "accent" } : { label: "En attente", tone: "neutral" };
  if (g.status === "won") {
    const turns = g.turnsUsed && g.turnsUsed > TURNS ? "mort subite" : `${g.turnsUsed} tours`;
    return { label: `Réussie · ${turns}`, tone: "success" };
  }
  if (g.status === "lost") return { label: "Échouée", tone: "danger" };
  return { label: "Abandonnée", tone: "neutral" };
}

/** Page d'accueil du jeu : nouvelle mission, mes missions, classement des duos. */
export function AgentsLobby() {
  const [games, setGames] = useState<LobbyGame[] | null>(null);
  const [partners, setPartners] = useState<Who[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ games: LobbyGame[]; partners: Who[] }>("/api/agents/games");
      setGames(r.games);
      setPartners(r.partners);
    } catch {
      setGames((g) => g ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const start = async (partnerId: string) => {
    setBusy(partnerId);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/agents/games", { body: { partnerId } });
      window.location.href = `/agents/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(null);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = partners.filter((p) => !q || p.name.toLowerCase().includes(q));
  const running = games?.filter((g) => g.status === "playing") ?? [];
  const finished = games?.filter((g) => g.status !== "playing") ?? [];

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Card>
          <h1 className="font-display text-text text-lg font-semibold">🕵️ {NAME}</h1>
          <p className="text-muted mt-1 text-sm">
            Le jeu d'espions coopératif à deux : chacun connaît ses agents, l'autre doit les
            retrouver dans la grille grâce à vos indices. {AGENTS_TOTAL} agents, {TURNS} tours, et
            surtout pas d'assassin.
          </p>
        </Card>

        <Card title="Mes missions">
          {games === null && <p className="text-muted text-sm">Chargement…</p>}
          {games?.length === 0 && (
            <p className="text-muted text-sm">Aucune mission : invite quelqu'un ci-dessous !</p>
          )}
          <ul className="flex flex-col gap-2">
            {[...running, ...finished].map((g) => {
              const s = statusOf(g);
              return (
                <li key={g.id}>
                  <a
                    href={`/agents/${g.id}`}
                    className={cx(
                      "hover:bg-surface-hover flex items-center gap-3 rounded-lg border p-2.5 text-sm transition",
                      g.myTurn && g.status === "playing" ? "border-accent/60" : "border-border",
                    )}
                  >
                    <Avatar name={g.partner.name} src={g.partner.image} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="text-text block truncate">avec {g.partner.name}</span>
                      {g.status === "playing" && (
                        <span className="text-muted text-xs">
                          {AGENTS_TOTAL - g.agentsLeft}/{AGENTS_TOTAL} agents ·{" "}
                          {g.turnsLeft > 0 ? `${g.turnsLeft} tours restants` : "mort subite"}
                        </span>
                      )}
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Nouvelle mission">
          <div className="flex flex-col gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher un membre"
              aria-label="Chercher un membre"
              className="max-w-xs"
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <ul className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => start(p.id)}
                    className="border-border hover:border-accent/60 hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm transition disabled:opacity-50"
                  >
                    <Avatar name={p.name} src={p.image} size={26} />
                    <span className="text-text min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="text-accent text-xs">{busy === p.id ? "…" : "Inviter"}</span>
                  </button>
                </li>
              ))}
            </ul>
            {games !== null && shown.length === 0 && (
              <p className="text-muted text-sm">Personne à inviter.</p>
            )}
          </div>
        </Card>
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-96">
        <Card title="Classement des duos">
          <DuoLeaderboard />
        </Card>
        <Card title="Règles">
          <Rules />
        </Card>
      </aside>
    </div>
  );
}
