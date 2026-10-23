import { getUsersByIds } from "@app/core";
import { type Idea, listIdeas } from "@app/ideas";
import { DESIGNS, listDesignVotes } from "@app/tcg";
import { type CardData, DesignPreview, DesignRating } from "@app/tcg/ui";
import { buttonClasses, Card } from "@app/ui";
import { Star } from "lucide-react";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/session";
import { rateDesignAction } from "./actions";
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

export default async function AdminCardsPage() {
  const admin = await getCurrentAdmin();
  const [{ items: ideas }, votes] = await Promise.all([
    listIdeas(admin, { limit: 100 }),
    listDesignVotes(admin),
  ]);
  const users = await getUsersByIds([
    ...new Set([...ideas.map((i) => i.authorId), ...votes.map((v) => v.userId)]),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const name = (id: string) => names.get(id) ?? "Membre inconnu";

  // Les idées avec une image d'abord : ce sont les plus parlantes pour juger un design.
  // Numéro de série dans l'ordre d'envoi (la plus ancienne idée est la n° 01).
  const pad = (n: number) => String(n).padStart(2, "0");
  const serials = new Map(
    ideas.map((idea, i) => [idea.id, `${pad(ideas.length - i)}/${pad(ideas.length)}`]),
  );
  const cards = ideas.length
    ? [...ideas]
        .sort((a, b) => Number(Boolean(b.imageKey)) - Number(Boolean(a.imageKey)))
        .map((idea) => ({ ...toCard(idea, name(idea.authorId)), serial: serials.get(idea.id) }))
    : SAMPLES;

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
          Propositions de design pour le futur jeu de cartes, remplies avec les idées de la boîte.
          Coût et puissance sont provisoires ; la rareté ne change que le look. Note chaque
          proposition de 1 à 5 étoiles, avec un commentaire si tu veux : les notes orienteront les
          prochaines propositions. Les designs 8 à 11 montrent trois finitions (peu commune, rare,
          légendaire) : passe la souris sur une carte pour l'incliner et voir le holo. Les designs
          12 à 17 sont des variantes Snap : l'effet s'affiche au survol, et la planche 17 montre les
          finitions jusqu'aux raretés Secrète (SR) et Super secrète (SSR). Les designs 18 à 27 sont
          dix autres styles Snap, du plus classique (or massif) au plus inattendu (croquis, glitch).
        </p>
      </Card>

      {DESIGNS.map((design, i) => {
        const mine = votes.find((v) => v.designId === design.id && v.userId === admin.id);
        const others = votes.filter((v) => v.designId === design.id && v.userId !== admin.id);
        return (
          <Card key={design.id} title={`${i + 1} · ${design.title}`}>
            <p className="text-muted mb-3 text-sm">{design.summary}</p>
            <DesignPreview designId={design.id} cards={cards} />
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
                        {v.stars}
                        <Star size={14} className="fill-accent" aria-label="étoiles" />
                      </span>
                      {v.comment && <p className="text-muted mt-1">{v.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
