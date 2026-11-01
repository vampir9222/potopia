"use client";
import { AppLink, useNavigate } from "@app/ui";
import { ArrowUpRight, Plus, Trophy } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { MemberSnapshot } from "../src/snapshot";
import { api } from "./api";
import { PHASE_LABELS } from "./common";
export type EditionSummary = Pick<MemberSnapshot["edition"], "id" | "year" | "name" | "phase">;
export function GotyHome({
  editions,
  canCreate,
  year,
}: {
  editions: EditionSummary[];
  canCreate: boolean;
  year: number;
}) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ id: string }>("editions", "POST", {
        year: Number(form.get("year")),
        name: String(form.get("name")),
      });
      navigate(`/goty/${result.id}/organisation`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="goty">
      <div className="goty-brand">
        <span className="goty-brand-symbol">
          <Trophy size={24} />
        </span>
        <span>
          GOTY <b>PARTY</b>
          <small>LE PALMARÈS, C’EST NOUS.</small>
        </span>
      </div>
      <section className="goty-hero">
        <div>
          <span className="goty-eyebrow">UNE ANNÉE ENSEMBLE</span>
          <h1>
            Nos jeux.
            <br />
            <em>Nos histoires.</em>
          </h1>
          <p>
            Les jeux qui nous ont marqués, les choix qu’on n’avait pas vus venir. Prépare ton
            palmarès et retrouve le groupe pour la soirée.
          </p>
          {canCreate && (
            <button className="goty-button" onClick={() => setCreating(!creating)}>
              <Plus size={17} />
              Créer une édition
            </button>
          )}
        </div>
        <div className="goty-hero-art" aria-hidden="true">
          <span className="goty-orbit" />
          <Trophy size={112} strokeWidth={1.1} />
          <span className="goty-art-caption">
            PLAYER CHOICE
            <br />
            {year}
          </span>
        </div>
      </section>
      {creating && (
        <form className="goty-panel goty-form" onSubmit={(e) => void create(e)}>
          <h2>Une nouvelle édition</h2>
          <fieldset disabled={busy}>
            <div className="goty-two">
              <label>
                Année
                <input
                  name="year"
                  type="number"
                  required
                  min={2000}
                  max={2200}
                  defaultValue={year}
                />
              </label>
              <label>
                Nom de l’édition
                <input name="name" required maxLength={100} defaultValue={`GOTY Party ${year}`} />
              </label>
            </div>
            <button className="goty-button" type="submit">
              {busy ? "Création…" : "Créer et choisir les participants"}
            </button>
          </fieldset>
          {error && (
            <p className="goty-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
      <div className="goty-section-heading">
        <h2>Les éditions</h2>
        <span className="goty-muted">À vivre et à revivre</span>
      </div>
      {editions.length === 0 ? (
        <div className="goty-empty">
          Aucune édition accessible pour le moment.
          {!canCreate && " Un organisateur pourra t’inscrire à la prochaine soirée."}
        </div>
      ) : (
        <div className="goty-edition-grid">
          {editions.map((edition) => (
            <AppLink
              key={edition.id}
              href={`/goty/${edition.id}${edition.phase === "closed" ? "/archives" : ""}`}
              className="goty-edition-card"
            >
              <span className="goty-year">{edition.year}</span>
              <span>
                <strong>{edition.name}</strong>
                <small>{PHASE_LABELS[edition.phase]}</small>
              </span>
              <ArrowUpRight size={23} />
            </AppLink>
          ))}
        </div>
      )}
    </div>
  );
}
