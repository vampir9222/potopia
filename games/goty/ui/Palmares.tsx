"use client";
import { LockKeyhole, Plus, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { MemberSnapshot } from "../src/snapshot";
import { moveItem, Sortable } from "./Sortable";
import type { Mutation } from "./useSnapshot";

type Props = { view: MemberSnapshot; userId: string; busy: boolean; mutate: Mutation };
function ChoiceForm({
  round,
  choice,
  games,
  disabled,
  mutate,
}: {
  round: MemberSnapshot["rounds"][number];
  choice?: MemberSnapshot["choices"][number];
  games: MemberSnapshot["games"];
  disabled: boolean;
  mutate: Mutation;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(`choices/${round.id}`, "PUT", {
      gameId: form.get("gameId") || null,
      precision: form.get("precision"),
      youtube: form.get("youtube") || null,
    });
  }
  return (
    <form className="goty-panel goty-form" onSubmit={(e) => void submit(e)}>
      <div className="goty-section-heading">
        <h3>{round.name}</h3>
        {round.status !== "draft" && (
          <span className="goty-pill">
            <LockKeyhole size={13} />
            Annoncée
          </span>
        )}
      </div>
      <fieldset disabled={disabled}>
        {round.rank !== null ? (
          <>
            <p>{games.find((game) => game.id === choice?.gameId)?.title}</p>
            <input type="hidden" name="gameId" value={choice?.gameId ?? ""} />
          </>
        ) : (
          <label>
            Jeu choisi
            <select name="gameId" defaultValue={choice?.gameId ?? ""}>
              <option value="">Aucun choix pour ce prix</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Précision <small>· secrète jusqu’à la révélation</small>
          <textarea
            name="precision"
            maxLength={500}
            rows={2}
            defaultValue={choice?.precision ?? ""}
            placeholder="Un personnage, un souvenir, une mention…"
          />
        </label>
        {round.soundtrack && (
          <label>
            Lien YouTube de la bande-son
            <input
              type="url"
              name="youtube"
              maxLength={255}
              defaultValue={choice?.youtube ?? ""}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
        )}
        <button className="goty-button secondary" type="submit">
          <Save size={15} />
          Enregistrer
        </button>
      </fieldset>
    </form>
  );
}
export function Palmares({ view, userId, busy, mutate }: Props) {
  const [add, setAdd] = useState("");
  if (!view.permissions.participate)
    return <div className="goty-empty">Seuls les participants inscrits composent un palmarès.</div>;
  if (view.edition.phase === "categories")
    return (
      <div className="goty-empty">
        L’organisateur ouvrira la préparation une fois les catégories fixées. Tu peux déjà ajouter
        tes jeux.
      </div>
    );
  const games = view.games.filter((g) => g.userId === userId);
  const own = view.choices.filter((c) => c.userId === userId);
  const topRounds = view.rounds
    .filter((r) => r.rank !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const ids = topRounds.flatMap((r) => {
    const choice = own.find((c) => c.roundId === r.id);
    return choice ? [choice.gameId] : [];
  });
  const editable = view.edition.phase !== "closed";
  const items = ids.map((id, index) => ({
    id,
    label: games.find((g) => g.id === id)?.title ?? "Jeu",
    locked: topRounds[index]?.status !== "draft",
  }));
  function allowed(next: string[]) {
    return topRounds.every(
      (r, index) =>
        r.status === "draft" ||
        (own.find((c) => c.roundId === r.id)?.gameId ?? null) === (next[index] ?? null),
    );
  }
  function saveTop(next: string[]) {
    if (allowed(next)) void mutate("top", "PUT", { gameIds: next });
  }
  return (
    <>
      <div className="goty-section-heading">
        <div>
          <h2>Mon palmarès</h2>
          <p className="goty-muted">
            Tes choix restent secrets jusqu’à leur révélation. Aucun bouton de validation globale.
          </p>
        </div>
        <span className="goty-pill">
          <LockKeyhole size={14} />
          Personnel
        </span>
      </div>
      {!games.length && <p className="goty-empty">Ajoute des jeux à ta liste pour commencer.</p>}
      <section className="goty-panel">
        <h3>Mon top · jusqu’à cinq jeux</h3>
        <p className="goty-muted">
          Du numéro 1 au numéro 5. Glisse la poignée ou utilise les flèches pour changer l’ordre.
        </p>
        <Sortable
          items={items}
          disabled={busy || !editable}
          onMove={(from, to) => {
            const next = moveItem(ids, from, to);
            saveTop(next);
          }}
          render={(id, index) => (
            <>
              <b className="goty-place">{index + 1}</b>
              {games.find((g) => g.id === id)?.title}
              <button
                className="goty-icon-button"
                aria-label={`Retirer la place ${index + 1}`}
                disabled={busy || !editable || !allowed(ids.filter((_, i) => i !== index))}
                onClick={() => saveTop(ids.filter((_, i) => i !== index))}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        />
        {ids.length < 5 && (
          <div className="goty-search">
            <select
              aria-label="Ajouter un jeu au top"
              value={add}
              onChange={(e) => setAdd(e.target.value)}
              disabled={!editable || busy}
            >
              <option value="">Choisir un jeu de ma liste…</option>
              {games
                .filter((g) => !ids.includes(g.id))
                .map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
            </select>
            <button
              className="goty-button secondary"
              disabled={!add || busy || !editable || !allowed([...ids, add])}
              onClick={() => {
                saveTop([...ids, add]);
                setAdd("");
              }}
            >
              <Plus size={16} />
              Ajouter
            </button>
          </div>
        )}
      </section>
      {ids.length > 0 && (
        <details className="goty-panel">
          <summary>Préciser les choix de mon top</summary>
          <div className="goty-two">
            {topRounds.map((round) => {
              const choice = own.find((c) => c.roundId === round.id);
              return choice ? (
                <ChoiceForm
                  key={`${round.id}:${choice.gameId}:${choice.precision}`}
                  round={round}
                  choice={choice}
                  games={games}
                  disabled={busy || !editable || round.status !== "draft"}
                  mutate={mutate}
                />
              ) : null;
            })}
          </div>
        </details>
      )}
      <h3 className="goty-subtitle">Mes prix</h3>
      <div className="goty-two">
        {view.rounds
          .filter((r) => r.rank === null)
          .map((round) => {
            const choice = own.find((c) => c.roundId === round.id);
            return (
              <ChoiceForm
                key={`${round.id}:${choice?.gameId}:${choice?.precision}:${choice?.youtube}`}
                round={round}
                choice={choice}
                games={games}
                disabled={busy || !editable || round.status !== "draft"}
                mutate={mutate}
              />
            );
          })}
      </div>
    </>
  );
}
