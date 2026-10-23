import { getUsersByIds } from "@app/core";
import { type Idea, listIdeas } from "@app/ideas";
import { DESIGNS, listDesignVotes } from "@app/tcg";
import { type CardData, DesignPreview, DesignRating } from "@app/tcg/ui";
import { buttonClasses, Card } from "@app/ui";
import { Star } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getCurrentAdmin } from "@/lib/session";
import { rateDesignAction } from "./actions";
import { CardPicker } from "./CardPicker";
import { CARD_COOKIE } from "./constants";
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

/** Cartes fictives quand la boîte est vide (développement local). */
const SAMPLES: CardData[] = [
  {
    title: "Carte exemple",
    flavor: "Une idée de la boîte.",
    effect: "À la révélation : +2 puissance à une de tes cartes ici.",
    tag: "Exemple",
    rarity: "common",
    cost: 2,
    power: 4,
    imageUrl: null,
  },
  {
    title: "Autre exemple",
    flavor: null,
    effect: "Permanent : +1 puissance à tes autres cartes ici.",
    tag: "Exemple",
    rarity: "rare",
    cost: 3,
    power: 6,
    imageUrl: null,
  },
  {
    title: "Le lieu",
    flavor: "Un endroit.",
    effect: "Les cartes ici coûtent 1 de moins.",
    tag: "Lieu",
    rarity: "uncommon",
    cost: 1,
    power: 2,
    imageUrl: null,
  },
];

/** Moyenne des notes (0 étoile = commentaire sans note, ignoré), ou null sans note. */
function average(stars: number[]): number | null {
  const rated = stars.filter((n) => n > 0);
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
}

/** En dessous de ce seuil (moyenne), un design est écarté de la page. */
const DISCARD_AT = 2;

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ carte?: string }>;
}) {
  const admin = await getCurrentAdmin();
  const [{ items: ideas }, votes, params, jar] = await Promise.all([
    listIdeas(admin, { limit: 100 }),
    listDesignVotes(admin),
    searchParams,
    cookies(),
  ]);
  const users = await getUsersByIds([
    ...new Set([...ideas.map((i) => i.authorId), ...votes.map((v) => v.userId)]),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const name = (id: string) => names.get(id) ?? "Membre inconnu";

  // Numéro de série dans l'ordre d'envoi (la plus ancienne idée est la n° 01).
  const pad = (n: number) => String(n).padStart(2, "0");
  const serials = new Map(
    ideas.map((idea, i) => [idea.id, `${pad(ideas.length - i)}/${pad(ideas.length)}`]),
  );
  // Une seule carte remplit tous les designs : celle choisie (URL, puis cookie), sinon la
  // première idée avec une image.
  const wanted = params.carte ?? jar.get(CARD_COOKIE)?.value;
  const sample = ideas.find((i) => i.id === wanted) ?? ideas.find((i) => i.imageKey) ?? ideas[0];
  const cards = sample
    ? [{ ...toCard(sample, name(sample.authorId)), serial: serials.get(sample.id) }]
    : SAMPLES;

  // Designs notés 2 ou moins écartés ; ceux que l'admin n'a pas encore notés d'abord (les
  // nouveaux), puis les mieux notés.
  const rows = DESIGNS.map((design, i) => {
    const forDesign = votes.filter((v) => v.designId === design.id);
    return {
      design,
      number: i + 1,
      avg: average(forDesign.map((v) => v.stars)),
      mine: forDesign.find((v) => v.userId === admin.id),
      others: forDesign.filter((v) => v.userId !== admin.id),
    };
  });
  const discarded = rows.filter((r) => r.avg !== null && r.avg <= DISCARD_AT);
  const shown = rows
    .filter((r) => !discarded.includes(r))
    .sort(
      (a, b) => Number(Boolean(a.mine)) - Number(Boolean(b.mine)) || (b.avg ?? 0) - (a.avg ?? 0),
    );

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
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm">
            Propositions de design pour le futur jeu de cartes. Coût et puissance sont provisoires ;
            la rareté ne change que le look. Passe la souris sur une carte pour l&apos;incliner et
            voir son effet. Les propositions pas encore notées sont en haut ; celles notées 2 ou
            moins sont écartées (liste en bas de page).
          </p>
          {ideas.length > 0 && sample && (
            <CardPicker
              ideas={ideas.map((i) => ({ id: i.id, title: i.title }))}
              current={sample.id}
            />
          )}
        </div>
      </Card>

      {shown.map(({ design, number, avg, mine, others }) => (
        <Card
          key={design.id}
          title={`${number} · ${design.title}`}
          action={
            !mine ? (
              <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-xs font-semibold">
                Nouveau
              </span>
            ) : avg !== null ? (
              <span className="text-muted inline-flex items-center gap-1 text-xs">
                moyenne {Math.round(avg * 10) / 10}
                <Star size={12} className="fill-accent text-accent" aria-hidden />
              </span>
            ) : undefined
          }
        >
          <p className="text-muted mb-3 text-sm">{design.summary}</p>
          {/* Cartes réduites pour voir une planche entière d'un coup d'œil. */}
          <div style={{ zoom: 0.72 }}>
            <DesignPreview designId={design.id} cards={cards} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DesignRating
              designId={design.id}
              initial={mine ? { stars: mine.stars, comment: mine.comment } : null}
              action={rateDesignAction}
            />
            {others.length > 0 && (
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
        </Card>
      ))}

      {discarded.length > 0 && (
        <Card title="Designs écartés (2 étoiles ou moins)">
          <ul className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {discarded.map(({ design, number, avg }) => (
              <li key={design.id}>
                {number} · {design.title} ({Math.round((avg ?? 0) * 10) / 10} ★)
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
