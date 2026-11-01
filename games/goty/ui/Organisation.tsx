"use client";
import { AppLink } from "@app/ui";
import { Check, LockKeyhole, Plus, Users, Vote } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { MemberSnapshot } from "../src/snapshot";
import { api } from "./api";
import { moveItem, Sortable } from "./Sortable";
import type { Mutation } from "./useSnapshot";
type Props = { view: MemberSnapshot; userId: string; busy: boolean; mutate: Mutation };
export function Categories({ view, busy, mutate }: Props) {
  const [name, setName] = useState("");
  const open = view.edition.phase === "categories";
  const mayAdd = open
    ? view.permissions.participate
    : view.edition.phase === "preparation" && view.permissions.organize;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await mutate(open ? "proposals" : "rounds", "POST", { name })) setName("");
  }
  return (
    <>
      <div className="goty-section-heading">
        <div>
          <h2>Les catégories</h2>
          <p className="goty-muted">
            Neuf prix de base et vos idées. Il faut {Math.ceil(view.members.length * 0.75)} votes
            sur {view.members.length} pour adopter une proposition.
          </p>
        </div>
        <span className="goty-pill">
          {open ? (
            <>
              <Vote size={14} />
              Votes ouverts
            </>
          ) : (
            <>
              <LockKeyhole size={14} />
              Catégories fixées
            </>
          )}
        </span>
      </div>
      <div className="goty-two">
        <section className="goty-panel">
          <h3>Au programme</h3>
          <ul className="goty-simple-list">
            {view.rounds.map((round) => (
              <li key={round.id}>
                <span>{round.name}</span>
                <Check size={15} />
              </li>
            ))}
          </ul>
        </section>
        <section className="goty-panel">
          <h3>Vos propositions</h3>
          {!view.proposals.length && (
            <p className="goty-muted">Aucune proposition pour l’instant. Une idée de prix ?</p>
          )}
          <ul className="goty-simple-list">
            {view.proposals.map((proposal) => (
              <li key={proposal.id}>
                <span>
                  {proposal.name}
                  <small>
                    {proposal.votes} vote{proposal.votes > 1 ? "s" : ""}
                  </small>
                </span>
                <button
                  className={`goty-button ${proposal.voted ? "" : "secondary"}`}
                  disabled={!open || !view.permissions.participate || busy}
                  onClick={() =>
                    void mutate(`proposals/${proposal.id}/vote`, "PUT", { favor: !proposal.voted })
                  }
                >
                  {proposal.voted ? "Retirer mon vote" : "Je vote pour"}
                </button>
              </li>
            ))}
          </ul>
          {mayAdd && (
            <form className="goty-form" onSubmit={(e) => void submit(e)}>
              <label>
                {open ? "Proposer un prix" : "Ajouter une catégorie sans vote"}
                <input
                  required
                  minLength={open ? 2 : 1}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Meilleure exploration…"
                />
              </label>
              <button className="goty-button secondary" disabled={busy} type="submit">
                <Plus size={15} />
                {open ? "Proposer" : "Ajouter"}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

type MemberDraft = { userId: string; organizer: boolean; presenter: boolean };
export function Organisation({ view, busy, mutate, isAdmin }: Props & { isAdmin: boolean }) {
  const [eligible, setEligible] = useState<
    { id: string; name: string; image: string | null }[] | null
  >(null);
  const [draft, setDraft] = useState<MemberDraft[] | null>(null);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [error, setError] = useState("");
  const closed = view.edition.phase === "closed";
  const actual = view.members.map((m) => ({
    userId: m.id,
    organizer: m.organizer,
    presenter: m.presenter,
  }));
  const selected = draft ?? actual;
  const candidates = eligible ?? view.members;
  function change(next: MemberDraft[]) {
    if (!draft) setBaseVersion(view.edition.version);
    setDraft(next);
  }
  const items = view.rounds.map((r) => ({ id: r.id, label: r.name, locked: r.status !== "draft" }));
  return (
    <>
      <div className="goty-section-heading">
        <div>
          <h2>Organisation</h2>
          <p className="goty-muted">
            Préparer le groupe et le conducteur, sans lire les choix secrets.
          </p>
        </div>
        <AppLink
          className="goty-button secondary"
          href={`/goty/${view.edition.id}/tv`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ouvrir la TV ↗
        </AppLink>
      </div>
      {view.permissions.organize && view.edition.phase === "categories" && (
        <section className="goty-callout">
          <div>
            <h3>Prêts pour les palmarès ?</h3>
            <p>
              Enregistre les participants avant de clôturer les votes. Les propositions ayant
              atteint 75 % seront ajoutées au programme.
            </p>
          </div>
          <button
            className="goty-button"
            disabled={busy || draft !== null}
            onClick={() => {
              if (
                window.confirm(
                  "Fixer les catégories et ouvrir la préparation des palmarès ? Les votes seront fermés.",
                )
              )
                void mutate("prepare", "POST", { expectedVersion: view.edition.version });
            }}
          >
            Ouvrir la préparation
          </button>
        </section>
      )}
      <section className="goty-panel">
        <div className="goty-section-heading">
          <h3>
            <Users size={18} />
            Le groupe
          </h3>
          {view.permissions.organize && !closed && (
            <button
              className="goty-button secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                void api<{ members: NonNullable<typeof eligible> }>(
                  `editions/${view.edition.id}/eligible-members`,
                )
                  .then((data) => setEligible(data.members))
                  .catch((caught) =>
                    setError(caught instanceof Error ? caught.message : "Liste indisponible."),
                  );
              }}
            >
              Gérer les participants
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="goty-error">
            {error}
          </p>
        )}
        <div className="goty-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Jeux / choix</th>
                <th>Organisateur</th>
                <th>Présentateur</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((person) => {
                const current = view.members.find((m) => m.id === person.id);
                const member = selected.find((m) => m.userId === person.id);
                const cannotRemove =
                  current &&
                  (view.edition.phase !== "categories" ||
                    current.gameCount > 0 ||
                    (!isAdmin && current.organizer));
                const cannotAdd = !current && view.edition.phase === "live";
                return (
                  <tr key={person.id}>
                    <td>
                      <label className="goty-check">
                        <input
                          type="checkbox"
                          checked={!!member}
                          disabled={!eligible || closed || busy || !!cannotRemove || cannotAdd}
                          onChange={(e) =>
                            change(
                              e.target.checked
                                ? [
                                    ...selected,
                                    { userId: person.id, organizer: false, presenter: false },
                                  ]
                                : selected.filter((m) => m.userId !== person.id),
                            )
                          }
                        />
                        {person.name}
                      </label>
                    </td>
                    <td>{current ? `${current.gameCount} / ${current.choiceCount}` : "—"}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Organisateur : ${person.name}`}
                        checked={member?.organizer ?? false}
                        disabled={!eligible || !member || !isAdmin || closed || busy}
                        onChange={(e) =>
                          change(
                            selected.map((m) =>
                              m.userId === person.id ? { ...m, organizer: e.target.checked } : m,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Présentateur : ${person.name}`}
                        checked={member?.presenter ?? false}
                        disabled={!eligible || !member || closed || busy}
                        onChange={(e) =>
                          change(
                            selected.map((m) =>
                              m.userId === person.id ? { ...m, presenter: e.target.checked } : m,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {draft && (
          <div className="goty-row">
            <button
              className="goty-button"
              disabled={busy || selected.length === 0}
              onClick={async () => {
                await mutate("members", "PUT", { expectedVersion: baseVersion, members: selected });
                setDraft(null);
                setBaseVersion(null);
              }}
            >
              Enregistrer les participants
            </button>
            <button
              className="goty-button secondary"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setBaseVersion(null);
              }}
            >
              Annuler
            </button>
          </div>
        )}
        <p className="goty-muted">
          Les nombres indiquent seulement la progression. Les choix restent privés. Les nouveaux
          membres peuvent rejoindre jusqu’au lancement de la soirée.
        </p>
      </section>
      <section className="goty-panel">
        <h3>Le conducteur</h3>
        <p className="goty-muted">
          Glisse une poignée, utilise les flèches ou les touches haut/bas. Les rubriques déjà
          annoncées restent à leur place.
        </p>
        <Sortable
          items={items}
          disabled={busy || closed || (!view.permissions.organize && !view.permissions.present)}
          onMove={(from, to) => {
            const next = moveItem(items, from, to);
            if (items.some((item, index) => item.locked && next[index]?.id !== item.id)) return;
            void mutate("order", "PUT", {
              expectedVersion: view.edition.version,
              roundIds: next.map((r) => r.id),
            });
          }}
        />
      </section>
    </>
  );
}
