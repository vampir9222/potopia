"use client";
import { AppLink, VolumeControl } from "@app/ui";
import {
  ArrowRight,
  Eye,
  LockKeyhole,
  Maximize,
  Music2,
  Play,
  RotateCcw,
  Square,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import type { MemberSnapshot, PresentationSnapshot } from "../src/snapshot";
import { Cover, Standings, Trailer, YoutubePlayer } from "./common";
import type { Mutation } from "./useSnapshot";

export function CeremonyView({
  view,
  tv = false,
}: {
  view: MemberSnapshot | PresentationSnapshot;
  tv?: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [silenced, setSilenced] = useState<string | null>(null);
  const round = view.rounds.find((r) => r.id === view.edition.screen.roundId);
  const revealed =
    round?.revealedUsers.flatMap((userId) => {
      const choice = view.choices.find((c) => c.roundId === round.id && c.userId === userId);
      return choice ? [choice] : [];
    }) ?? [];
  const displayed = view.edition.screen.mode === "recap" ? revealed : revealed.slice(-1);
  const audio = view.edition.screen.audio;
  const song =
    audio && view.choices.find((c) => c.roundId === round?.id && c.userId === audio.userId);
  const youtube = song?.youtube ? new URL(song.youtube).searchParams.get("v") : null;
  const activeAudio = tv && enabled && audio && audio.nonce !== silenced && youtube;
  return (
    <div className={`goty-stage ${tv ? "goty-stage-tv" : ""}`}>
      {view.edition.screen.mode === "leaderboard" ? (
        <>
          <span className="goty-eyebrow">LES PRONOSTIQUEURS</span>
          <h2>Le classement</h2>
          <Standings entries={view.standings} />
        </>
      ) : view.edition.screen.mode === "waiting" ? (
        <div className="goty-stage-waiting">
          <Trophy size={74} strokeWidth={1} />
          <span className="goty-eyebrow">GOTY PARTY · {view.edition.year}</span>
          <h2>
            Nos jeux.
            <br />
            Nos histoires.
          </h2>
          <p>La soirée commence bientôt.</p>
        </div>
      ) : (
        <>
          <span className="goty-eyebrow">
            {view.edition.screen.mode === "recap" ? "LE RÉCAPITULATIF" : "À VOUS DE DEVINER"}
          </span>
          <h2>{round?.name ?? "La cérémonie"}</h2>
          {displayed.length === 0 ? (
            <div className="goty-stage-waiting">
              <Eye size={42} />
              <p>
                {round?.status === "announced"
                  ? "Les pronostics sont ouverts."
                  : "Les pronostics sont fermés."}
                <br />
                Le présentateur lancera la révélation.
              </p>
            </div>
          ) : (
            <div className={displayed.length > 1 ? "goty-recap-grid" : "goty-reveal-grid"}>
              {displayed.map((choice) => {
                const game = view.games.find((g) => g.id === choice.gameId);
                if (!game) return null;
                return (
                  <article className="goty-reveal" key={`${choice.roundId}:${choice.userId}`}>
                    <Cover game={game} large />
                    <div>
                      <span className="goty-eyebrow">
                        LE CHOIX DE {view.members.find((m) => m.id === choice.userId)?.name}
                      </span>
                      <h3>{game.title}</h3>
                      {choice.precision && <p className="goty-quote">« {choice.precision} »</p>}
                      <p className="goty-muted">{game.platform}</p>
                      <Trailer game={game} onOpen={() => setSilenced(audio?.nonce ?? null)} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {tv && (
        <div className="goty-tv-sound">
          <button
            className="goty-button secondary"
            onClick={() => {
              setEnabled(!enabled);
              if (!enabled) setSilenced(null);
            }}
          >
            <Music2 size={16} />
            {enabled ? "Couper les bandes-son" : "Activer les bandes-son"}
          </button>
          <VolumeControl />
          {audio && enabled && (
            <button className="goty-text-button" onClick={() => setSilenced(audio.nonce)}>
              <Square size={14} />
              Arrêter sur cet écran
            </button>
          )}
        </div>
      )}
      {activeAudio && (
        <div className="goty-sound-player">
          <YoutubePlayer key={audio.nonce} videoId={youtube} />
          <small>
            Si le son est bloqué, clique dans le lecteur.{" "}
            <a href={song?.youtube ?? ""} target="_blank" rel="noopener noreferrer">
              Ouvrir la musique sur YouTube ↗
            </a>
          </small>
        </div>
      )}
    </div>
  );
}

export function Ceremony({
  view,
  busy,
  mutate,
}: {
  view: MemberSnapshot;
  busy: boolean;
  mutate: Mutation;
}) {
  const active = view.rounds.find((r) => ["announced", "locked", "revealing"].includes(r.status));
  const next = view.rounds.find((r) => r.status === "draft");
  const live = ["preparation", "live"].includes(view.edition.phase);
  const command = (body: object) =>
    mutate("control", "POST", { expectedVersion: view.edition.version, ...body });
  return (
    <>
      <div className="goty-section-heading">
        <div>
          <h2>La cérémonie</h2>
          <p className="goty-muted">Chaque révélation est déclenchée par le présentateur.</p>
        </div>
        <AppLink
          className="goty-button secondary"
          target="_blank"
          rel="noopener noreferrer"
          href={`/goty/${view.edition.id}/tv`}
        >
          Ouvrir l’écran TV ↗
        </AppLink>
      </div>
      <div className="goty-ceremony-layout">
        <CeremonyView view={view} />
        <aside className="goty-panel goty-remote">
          <h3>La télécommande</h3>
          {!view.permissions.present ? (
            <p className="goty-muted">
              Le présentateur pilote la soirée. Tu peux compléter tes pronostics sur ton téléphone.
            </p>
          ) : (
            <fieldset disabled={busy || !live}>
              {!active && next && (
                <button
                  className="goty-button"
                  onClick={() => void command({ action: "announce", roundId: next.id })}
                >
                  <Play size={16} />
                  Annoncer {next.name}
                </button>
              )}
              {active && (
                <>
                  <p>
                    <b>{active.name}</b>
                    <small>
                      {active.revealedCount} / {active.eligibleCount ?? "—"} choix révélés
                    </small>
                  </p>
                  {active.status === "announced" && (
                    <button
                      className="goty-button"
                      onClick={() => void command({ action: "lock", roundId: active.id })}
                    >
                      <LockKeyhole size={16} />
                      Fermer les pronostics
                    </button>
                  )}
                  {["locked", "revealing"].includes(active.status) &&
                    active.revealedCount < (active.eligibleCount ?? 0) && (
                      <button
                        className="goty-button"
                        onClick={() => void command({ action: "reveal", roundId: active.id })}
                      >
                        <Eye size={16} />
                        Révéler le prochain choix
                      </button>
                    )}
                  {["locked", "revealing"].includes(active.status) &&
                    active.revealedCount === (active.eligibleCount ?? 0) && (
                      <button
                        className="goty-button"
                        onClick={() => void command({ action: "recap", roundId: active.id })}
                      >
                        <ArrowRight size={16} />
                        Afficher le récapitulatif
                      </button>
                    )}
                  {active.status === "locked" && active.revealedCount === 0 && (
                    <button
                      className="goty-button secondary"
                      onClick={() => void command({ action: "reopen", roundId: active.id })}
                    >
                      Rouvrir les pronostics
                    </button>
                  )}
                </>
              )}
              <button
                className="goty-button secondary"
                onClick={() =>
                  void command({
                    action: view.edition.screen.mode === "leaderboard" ? "resume" : "leaderboard",
                  })
                }
              >
                <Trophy size={16} />
                {view.edition.screen.mode === "leaderboard"
                  ? "Reprendre la cérémonie"
                  : "Afficher le classement"}
              </button>
              {["round", "recap"].includes(view.edition.screen.mode) &&
                view.choices
                  .filter(
                    (choice) =>
                      choice.roundId === view.edition.screen.roundId &&
                      choice.youtube &&
                      view.rounds
                        .find((r) => r.id === choice.roundId)
                        ?.revealedUsers.includes(choice.userId),
                  )
                  .map((choice) => (
                    <button
                      key={choice.userId}
                      className="goty-button secondary"
                      onClick={() => void command({ action: "play", targetId: choice.userId })}
                    >
                      Lire la bande-son de {view.members.find((m) => m.id === choice.userId)?.name}
                    </button>
                  ))}
              {view.edition.screen.audio && (
                <>
                  <button
                    className="goty-button secondary"
                    onClick={() => void command({ action: "stop" })}
                  >
                    <Square size={14} />
                    Arrêter la bande-son
                  </button>
                </>
              )}
              {!active && !next && (
                <button
                  className="goty-button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Clôturer l’édition ? Elle sera accessible à tous les membres en lecture seule.",
                      )
                    )
                      void command({ action: "close" });
                  }}
                >
                  Clôturer et archiver
                </button>
              )}
              <button
                className="goty-text-button danger"
                onClick={() => {
                  if (
                    window.confirm(
                      "Revenir en préparation ? Les révélations et les points seront remis à zéro. Les choix et pronostics seront conservés. Les spectateurs peuvent déjà avoir mémorisé les réponses.",
                    )
                  )
                    void command({ action: "restart", confirmRestart: true });
                }}
              >
                <RotateCcw size={14} />
                Revenir en préparation
              </button>
            </fieldset>
          )}
          {view.edition.phase === "closed" && (
            <p className="goty-muted">
              La soirée est terminée. Retrouve les palmarès dans les archives.
            </p>
          )}
          {view.edition.phase === "categories" && (
            <p className="goty-muted">Ouvre d’abord la préparation depuis Organisation.</p>
          )}
        </aside>
      </div>
    </>
  );
}

export function Archives({ view }: { view: MemberSnapshot }) {
  const [memberId, setMemberId] = useState(view.members[0]?.id ?? "");
  const [mode, setMode] = useState("participant");
  if (view.edition.phase !== "closed")
    return (
      <div className="goty-empty">
        Les archives seront disponibles une fois la cérémonie terminée.
      </div>
    );
  const choiceText = (roundId: string, userId: string) => {
    const choice = view.choices.find((c) => c.roundId === roundId && c.userId === userId);
    const game = view.games.find((g) => g.id === choice?.gameId);
    return choice && game
      ? `${game.title}${choice.precision ? ` · ${choice.precision}` : ""}`
      : "—";
  };
  return (
    <>
      <h2>Les souvenirs de {view.edition.year}</h2>
      <p className="goty-muted">
        Une édition terminée, des découvertes à garder. Archives en lecture seule.
      </p>
      <div className="goty-row">
        <button
          className={`goty-button ${mode === "participant" ? "" : "secondary"}`}
          onClick={() => setMode("participant")}
        >
          Par participant
        </button>
        <button
          className={`goty-button ${mode === "rubrique" ? "" : "secondary"}`}
          onClick={() => setMode("rubrique")}
        >
          Comparer les rubriques
        </button>
      </div>
      {mode === "participant" ? (
        <section className="goty-panel goty-form">
          <label>
            Participant
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {view.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <ul className="goty-simple-list">
            {view.rounds.map((r) => (
              <li key={r.id}>
                <b>{r.name}</b>
                <span>{choiceText(r.id, memberId)}</span>
              </li>
            ))}
          </ul>
          <h3>Sa liste de jeux</h3>
          <p>
            {view.games
              .filter((g) => g.userId === memberId)
              .map((g) => g.title)
              .join(" · ") || "Aucun jeu"}
          </p>
        </section>
      ) : (
        <div className="goty-table-wrap goty-panel">
          <table>
            <thead>
              <tr>
                <th>Rubrique</th>
                {view.members.map((m) => (
                  <th key={m.id}>{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rounds.map((r) => (
                <tr key={r.id}>
                  <th>{r.name}</th>
                  {view.members.map((m) => (
                    <td key={m.id}>{choiceText(r.id, m.id)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="goty-panel">
        <h3>Le classement final</h3>
        <Standings entries={view.standings} />
        <h3>Les bonnes intuitions</h3>
        <ul className="goty-simple-list">
          {view.predictions
            .filter(
              (p) =>
                view.rounds.find((r) => r.id === p.roundId)?.revealedUsers.includes(p.targetId) &&
                view.choices.some(
                  (c) =>
                    c.roundId === p.roundId && c.userId === p.targetId && c.gameId === p.gameId,
                ),
            )
            .map((p) => (
              <li key={`${p.roundId}:${p.userId}:${p.targetId}`}>
                <span>
                  {view.members.find((m) => m.id === p.userId)?.name} a deviné le choix de{" "}
                  {view.members.find((m) => m.id === p.targetId)?.name}
                </span>
                <small>
                  {view.rounds.find((r) => r.id === p.roundId)?.name} ·{" "}
                  {view.games.find((g) => g.id === p.gameId)?.title}
                </small>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

export function FullscreenButton() {
  return (
    <button
      className="goty-button secondary"
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }}
    >
      <Maximize size={16} />
      Plein écran
    </button>
  );
}
