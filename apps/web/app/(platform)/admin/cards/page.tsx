import { getUsersByIds } from "@app/core";
import { getIdea, type Idea, listIdeas } from "@app/ideas";
import { DESIGNS, type DesignVote, listDesignVotes } from "@app/tcg";
import { type CardData, DesignPreview, DesignRating } from "@app/tcg/ui";
import { buttonClasses, Card } from "@app/ui";
import { Star } from "lucide-react";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";
import { rateDesignAction } from "./actions";
import { SAMPLE_IDEA_ID } from "./constants";
import { designFonts } from "./fonts";

export const metadata: Metadata = { title: "Carte design" };

/** Coût de 1 à 6, stable pour une idée donnée. La rareté n'influence jamais les stats. */
function costOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 6) + 1;
}

function toCard(idea: Idea, author: string): CardData {
  const cost = costOf(idea.id);
  const description = idea.description.trim();
  return {
    title: idea.title,
    flavor: description && description !== "--" ? description : null,
    effect: idea.effectIdea?.trim() || "Effet à définir.",
    tag: idea.concernedPeople?.trim() || "Idée",
    rarity: idea.suggestedRarity ?? "common",
    cost,
    // Budget de puissance : 2 × coût + 1, moins 1 quand la carte a un effet.
    power: 2 * cost + (idea.effectIdea ? 0 : 1),
    imageUrl: idea.imageKey ? `/api/admin/ideas/${idea.id}/image` : null,
    author,
  };
}

/** Carte fictive quand l'idée d'exemple n'existe pas (développement local). */
const FALLBACK: CardData = {
  title: "Carte exemple",
  flavor: "Une idée de la boîte.",
  effect: "À la révélation : −2 puissance à la carte adverse la plus forte ici.",
  tag: "Exemple",
  rarity: "common",
  cost: 2,
  power: 4,
  imageUrl: null,
  author: "Potopia",
  serial: "01/01",
};

/** Moyenne des notes (0 étoile = commentaire sans note, ignoré), ou null sans note. */
function average(votes: DesignVote[]): number | null {
  const rated = votes.filter((v) => v.stars > 0).map((v) => v.stars);
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
}

/** En dessous de ce seuil (moyenne), un design est écarté de la liste principale. */
const DISCARD_AT = 2;

export default async function AdminCardsPage() {
  const admin = await getCurrentAdmin();
  const [sample, { items: ideas }, votes] = await Promise.all([
    getIdea(admin, SAMPLE_IDEA_ID),
    // Seulement pour le numéro de série de la carte ; aucune autre idée n'est envoyée à la page.
    listIdeas(admin, { limit: 100 }),
    listDesignVotes(admin),
  ]);
  const users = await getUsersByIds([
    ...new Set([...(sample ? [sample.authorId] : []), ...votes.map((v) => v.userId)]),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const name = (id: string) => names.get(id) ?? "Membre inconnu";

  const pad = (n: number) => String(n).padStart(2, "0");
  const rank = sample ? ideas.findIndex((i) => i.id === sample.id) : -1;
  const card: CardData = sample
    ? {
        ...toCard(sample, name(sample.authorId)),
        serial: rank >= 0 ? `${pad(ideas.length - rank)}/${pad(ideas.length)}` : undefined,
      }
    : FALLBACK;
  const cards = [card];

  // Ordre fixe (les plus récentes en haut) : rien ne bouge quand on note.
  const rows = DESIGNS.map((design, i) => {
    const forDesign = votes.filter((v) => v.designId === design.id);
    return {
      design,
      number: i + 1,
      avg: average(forDesign),
      mine: forDesign.find((v) => v.userId === admin.id),
      others: forDesign.filter((v) => v.userId !== admin.id),
    };
  }).reverse();
  const discarded = rows.filter((r) => r.avg !== null && r.avg <= DISCARD_AT);
  const shown = rows.filter((r) => !discarded.includes(r));

  return (
    <div className={`${designFonts} flex flex-col gap-4`}>
      <Card
        title="Carte design"
        action={
          <a
            href="/api/admin/cards/votes"
            download
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Exporter les notes (JSON)
          </a>
        }
      >
        <p className="text-muted text-sm">
          Propositions de design pour le futur jeu de cartes, toutes avec la même carte. Coût et
          puissance sont provisoires ; la rareté ne change que le look. Passe la souris sur une
          carte pour l&apos;incliner et voir son effet. Les plus récentes sont en haut ; celles
          notées 2 ou moins sont rangées en bas de page (clique sur un nom pour revoir
          l&apos;exemple).
        </p>
      </Card>

      {shown.map(({ design, number, avg, mine, others }) => (
        <Card
          key={design.id}
          title={`${number} · ${design.title}`}
          action={
            <span className="flex items-center gap-2 text-xs">
              {!mine && (
                <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 font-semibold">
                  À noter
                </span>
              )}
              {avg !== null && (
                <span className="text-muted inline-flex items-center gap-1">
                  moyenne {Math.round(avg * 10) / 10}
                  <Star size={12} className="fill-accent text-accent" aria-hidden />
                </span>
              )}
            </span>
          }
        >
          <p className="text-muted mb-3 text-sm">{design.summary}</p>
          {/* Cartes réduites pour voir une planche entière d'un coup d'œil. */}
          <div style={{ zoom: 0.72 }}>
            <DesignPreview designId={design.id} cards={cards} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-text text-sm font-medium">Ton avis</p>
              <DesignRating
                designId={design.id}
                initial={mine ? { stars: mine.stars, comment: mine.comment } : null}
                action={rateDesignAction}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-text text-sm font-medium">Avis des autres</p>
              {others.length === 0 ? (
                <p className="text-muted text-sm">Pas encore d&apos;avis.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {others.map((v) => (
                    <li key={v.userId} className="border-border rounded-md border p-2">
                      <span className="text-text font-medium">{name(v.userId)}</span>{" "}
                      <span className="text-accent inline-flex items-center gap-0.5 align-middle">
                        {v.stars > 0 ? (
                          <>
                            {v.stars}
                            <Star size={14} className="fill-accent" aria-label="étoiles" />
                          </>
                        ) : (
                          <span className="text-muted">sans note</span>
                        )}
                      </span>
                      {v.comment && <p className="text-muted mt-1">{v.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      ))}

      {discarded.length > 0 && (
        <Card title="Designs écartés (2 étoiles ou moins)">
          <div className="flex flex-col gap-2">
            {discarded.map(({ design, number, avg }) => (
              <details key={design.id} className="border-border rounded-md border px-3 py-2">
                <summary className="text-muted cursor-pointer text-sm">
                  {number} · {design.title} ({Math.round((avg ?? 0) * 10) / 10} ★)
                </summary>
                <div className="mt-3" style={{ zoom: 0.6 }}>
                  <DesignPreview designId={design.id} cards={cards} />
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
