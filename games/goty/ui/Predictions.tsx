"use client";
import { ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { MemberSnapshot } from "../src/snapshot";
import type { Mutation } from "./useSnapshot";
export function Predictions({
  view,
  userId,
  busy,
  mutate,
}: {
  view: MemberSnapshot;
  userId: string;
  busy: boolean;
  mutate: Mutation;
}) {
  const [roundId, setRoundId] = useState(view.edition.screen.roundId ?? view.rounds[0]?.id ?? "");
  const round = view.rounds.find((r) => r.id === roundId) ?? view.rounds[0];
  if (!round) return null;
  const index = view.rounds.indexOf(round);
  const open =
    view.permissions.participate &&
    ["preparation", "live"].includes(view.edition.phase) &&
    ["draft", "announced"].includes(round.status);
  return (
    <>
      <div className="goty-section-heading">
        <div>
          <h2>Mes pronostics</h2>
          <p className="goty-muted">
            Un jeu bien deviné, un point. Les réponses restent facultatives.
          </p>
        </div>
        <span className="goty-pill">
          {open ? (
            "Pronostics ouverts"
          ) : (
            <>
              <LockKeyhole size={14} />
              Pronostics fermés
            </>
          )}
        </span>
      </div>
      <div className="goty-round-picker">
        <button
          className="goty-icon-button"
          aria-label="Rubrique précédente"
          disabled={index === 0}
          onClick={() => setRoundId(view.rounds[index - 1]?.id ?? "")}
        >
          <ChevronLeft />
        </button>
        <select
          aria-label="Rubrique à pronostiquer"
          value={round.id}
          onChange={(e) => setRoundId(e.target.value)}
        >
          {view.rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          className="goty-icon-button"
          aria-label="Rubrique suivante"
          disabled={index === view.rounds.length - 1}
          onClick={() => setRoundId(view.rounds[index + 1]?.id ?? "")}
        >
          <ChevronRight />
        </button>
      </div>
      {view.edition.phase === "categories" && (
        <p className="goty-empty">Les pronostics ouvriront avec la préparation des palmarès.</p>
      )}
      <div className="goty-two">
        {view.members
          .filter((m) => m.id !== userId)
          .map((member) => {
            const games = view.games.filter((g) => g.userId === member.id);
            const current = view.predictions.find(
              (p) => p.roundId === round.id && p.targetId === member.id && p.userId === userId,
            );
            const neutral =
              round.eligibleUsers !== null && !round.eligibleUsers.includes(member.id);
            const revealed = view.choices.find(
              (c) =>
                c.roundId === round.id &&
                c.userId === member.id &&
                round.revealedUsers.includes(member.id),
            );
            return (
              <article className="goty-panel goty-form" key={member.id}>
                <h3>{member.name}</h3>
                <label>
                  Quel jeu a-t-il choisi ?
                  <select
                    aria-label={`Pronostic pour ${member.name}`}
                    disabled={!open || busy || neutral || !games.length}
                    value={current?.gameId ?? ""}
                    onChange={(e) =>
                      void mutate(`predictions/${round.id}/${member.id}`, "PUT", {
                        gameId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Sans pronostic</option>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="goty-muted">
                  {neutral
                    ? "Aucun choix pour cette rubrique : pronostic neutralisé."
                    : revealed
                      ? `Réponse révélée : ${view.games.find((g) => g.id === revealed.gameId)?.title ?? "—"}${current ? (current.gameId === revealed.gameId ? " · Bien deviné ! +1 point" : " · Ce sera pour la prochaine.") : ""}`
                      : !games.length
                        ? "Sa liste de jeux est encore vide."
                        : open
                          ? "Modifiable jusqu’à la fermeture des pronostics."
                          : "Les réponses sont verrouillées."}
                </p>
              </article>
            );
          })}
      </div>
    </>
  );
}
