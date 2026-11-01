"use client";
import { AppLink, useNavigate } from "@app/ui";
import {
  ArrowRight,
  CalendarDays,
  Crosshair,
  Gamepad2,
  Lightbulb,
  Radio,
  RefreshCw,
  Settings2,
  Trophy,
  Users,
} from "lucide-react";
import type { MemberSnapshot, PresentationSnapshot } from "../src/snapshot";
import { Archives, Ceremony, CeremonyView, FullscreenButton } from "./Ceremony";
import { PHASE_LABELS, PhaseSteps } from "./common";
import { Games } from "./Games";
import type { EditionSummary } from "./Home";
import { Categories, Organisation } from "./Organisation";
import { Palmares } from "./Palmares";
import { Predictions } from "./Predictions";
import { useSnapshot } from "./useSnapshot";

export const GOTY_VIEWS = [
  "jeux",
  "palmares",
  "categories",
  "pronostics",
  "organisation",
  "ceremonie",
  "archives",
] as const;
export type GotyView = "accueil" | (typeof GOTY_VIEWS)[number];
const NAV = [
  ["accueil", "Vue d’ensemble", CalendarDays],
  ["jeux", "Les jeux", Gamepad2],
  ["palmares", "Mon palmarès", Trophy],
  ["categories", "Catégories", Lightbulb],
  ["pronostics", "Pronostics", Crosshair],
  ["ceremonie", "La soirée", Radio],
  ["organisation", "Organisation", Settings2],
  ["archives", "Archives", CalendarDays],
] as const;
function Dashboard({ view, userId }: { view: MemberSnapshot; userId: string }) {
  const base = `/goty/${view.edition.id}`;
  const counts = [
    [Gamepad2, view.games.filter((g) => g.userId === userId).length, "Mes jeux de l’année"],
    [Trophy, view.choices.filter((c) => c.userId === userId).length, "Mes choix renseignés"],
    [Crosshair, view.predictions.filter((p) => p.userId === userId).length, "Mes pronostics"],
    [Users, view.members.length, "Autour de la table"],
  ] as const;
  return (
    <>
      <section className="goty-hero">
        <div>
          <span className="goty-eyebrow">GOTY PARTY · {view.edition.year}</span>
          <h1>
            Une année de jeux.
            <br />
            <em>Une soirée à partager.</em>
          </h1>
          <p>
            Prépare tes coups de cœur, garde tes choix secrets et tente de deviner ceux des autres.
          </p>
          <AppLink
            className="goty-button"
            href={`${base}/${view.edition.phase === "categories" ? "jeux" : view.edition.phase === "live" ? "pronostics" : view.edition.phase === "closed" ? "archives" : "palmares"}`}
          >
            {view.edition.phase === "closed"
              ? "Revivre l’édition"
              : view.edition.phase === "live"
                ? "Faire mes pronostics"
                : "À moi de jouer"}
            <ArrowRight size={17} />
          </AppLink>
        </div>
        <div className="goty-hero-art" aria-hidden="true">
          <span className="goty-orbit" />
          <Trophy size={100} strokeWidth={1.1} />
          <span className="goty-art-caption">
            LES CHOIX SONT PERSONNELS.
            <br />
            LES SOUVENIRS, COLLECTIFS.
          </span>
        </div>
      </section>
      <div className="goty-stat-grid">
        {counts.map(([Icon, number, label]) => (
          <div className="goty-stat" key={label}>
            <Icon size={22} />
            <strong>{number}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="goty-two">
        <section className="goty-panel">
          <h2>Ta quête en trois étapes</h2>
          {[
            ["jeux", "01", "Raconte ton année", "Ajoute tes jeux ou importe ta liste."],
            [
              "palmares",
              "02",
              "Compose ton palmarès",
              "Un top, des prix, et des choix bien gardés.",
            ],
            [
              "pronostics",
              "03",
              "Lis dans leurs pensées",
              "Un bon pronostic, un point pendant la soirée.",
            ],
          ].map(([route, step, title, text]) => (
            <AppLink key={route} href={`${base}/${route}`} className="goty-quest">
              <b>{step}</b>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              <ArrowRight size={17} />
            </AppLink>
          ))}
        </section>
        <section className="goty-panel">
          <h2>Le groupe</h2>
          <ul className="goty-simple-list">
            {view.members.map((member) => (
              <li key={member.id}>
                <span>
                  {member.name}
                  {member.id === userId ? " · moi" : ""}
                </span>
                <small>
                  {member.gameCount} jeux · {member.choiceCount} choix
                </small>
              </li>
            ))}
          </ul>
          <p className="goty-muted">La progression est visible, les réponses restent secrètes.</p>
        </section>
      </div>
    </>
  );
}
export function GotyApp({
  initial,
  userId,
  isAdmin,
  editions,
  page = "accueil",
}: {
  initial: MemberSnapshot;
  userId: string;
  isAdmin: boolean;
  editions: EditionSummary[];
  page?: GotyView;
}) {
  const {
    snapshot: view,
    error,
    busy,
    mutate,
    refresh,
    isAdmin: liveAdmin,
  } = useSnapshot(initial, userId, false, isAdmin);
  const navigate = useNavigate();
  if (!view)
    return (
      <div className="goty goty-empty" role="alert">
        {error || "L’accès à cette édition a changé."}
        <p>
          <AppLink href="/goty">Revenir aux éditions</AppLink> ·{" "}
          <AppLink href="/login">Se reconnecter</AppLink>
        </p>
      </div>
    );
  const props = { view, userId, busy, mutate };
  return (
    <div className="goty">
      <div className="goty-topline">
        <AppLink href="/goty" className="goty-brand">
          <span className="goty-brand-symbol">
            <Trophy size={23} />
          </span>
          <span>
            GOTY <b>PARTY</b>
            <small>LE PALMARÈS, C’EST NOUS.</small>
          </span>
        </AppLink>
        <div className="goty-row">
          <span className="goty-pill goty-live">
            <span />
            {PHASE_LABELS[view.edition.phase]}
          </span>
          <select
            aria-label="Édition GOTY"
            value={view.edition.id}
            onChange={(e) =>
              navigate(`/goty/${e.target.value}${page === "accueil" ? "" : `/${page}`}`)
            }
          >
            {editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {edition.year} · {edition.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <PhaseSteps phase={view.edition.phase} />
      <nav className="goty-nav" aria-label="GOTY Party">
        {NAV.filter(
          ([id]) =>
            (id !== "organisation" || view.permissions.organize || view.permissions.present) &&
            (id !== "archives" || view.edition.phase === "closed"),
        ).map(([id, label, Icon]) => (
          <AppLink
            key={id}
            aria-current={page === id ? "page" : undefined}
            href={`/goty/${view.edition.id}${id === "accueil" ? "" : `/${id}`}`}
          >
            <Icon size={16} />
            {label}
          </AppLink>
        ))}
      </nav>
      {error && (
        <div className="goty-error goty-row" role="alert">
          <span>{error}</span>
          <button className="goty-text-button" onClick={() => void refresh()}>
            <RefreshCw size={15} />
            Réessayer
          </button>
        </div>
      )}
      <div className="goty-content" aria-busy={busy}>
        {page === "accueil" ? (
          <Dashboard view={view} userId={userId} />
        ) : page === "jeux" ? (
          <Games {...props} />
        ) : page === "palmares" ? (
          <Palmares {...props} />
        ) : page === "categories" ? (
          <Categories {...props} />
        ) : page === "pronostics" ? (
          <Predictions {...props} />
        ) : page === "organisation" ? (
          view.permissions.organize || view.permissions.present ? (
            <Organisation {...props} isAdmin={liveAdmin} />
          ) : (
            <div className="goty-empty">
              Cet espace est réservé à l’organisation et à la présentation.
            </div>
          )
        ) : page === "ceremonie" ? (
          <Ceremony {...props} />
        ) : (
          <Archives view={view} />
        )}
      </div>
      {busy && (
        <span className="goty-save-status" role="status">
          Enregistrement…
        </span>
      )}
    </div>
  );
}

export function GotyTV({ initial, viewerId }: { initial: PresentationSnapshot; viewerId: string }) {
  const { snapshot, error, refresh } = useSnapshot(initial, viewerId, true);
  return (
    <div className="goty goty-tv">
      <header className="goty-topline">
        <AppLink href={`/goty/${initial.edition.id}/ceremonie`} className="goty-brand">
          <Trophy size={24} />
          GOTY <b>PARTY</b>
        </AppLink>
        <div className="goty-row">
          <span className="goty-muted">
            {initial.edition.year} · {initial.edition.name}
          </span>
          <FullscreenButton />
        </div>
      </header>
      {error && (
        <div role="alert" className="goty-error">
          {error}
          <button className="goty-text-button" onClick={() => void refresh()}>
            Réessayer
          </button>
        </div>
      )}
      {snapshot ? (
        <CeremonyView view={snapshot} tv />
      ) : (
        <div className="goty-empty">
          Connexion ou accès à vérifier. <AppLink href="/login">Se reconnecter</AppLink>
        </div>
      )}
    </div>
  );
}
