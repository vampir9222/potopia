import type { Card } from "../src/card-rules";
import type { CardData } from "./cards";
import { PremiumDefs } from "./premium";
import { SnapDefs } from "./snap";
import type { TopLayout } from "./v4";
import { FinalCard } from "./v5";

/** Ce qu'il faut d'une carte pour l'afficher (la carte enregistrée, ou le formulaire en cours). */
export type GameCardFields = Pick<
  Card,
  "name" | "rarity" | "type" | "family" | "cost" | "power" | "effectText" | "flavor" | "number"
> & {
  /** Code du set, affiché devant le numéro (« S1 07/116 »). */
  setCode?: string | null;
  /** Cadrage de l'illustration. */
  imageFrame?: Card["imageFrame"];
};

/** Ligne de type affichée : « Instrument — Grenouilles », ou le type seul sans famille. */
export function typeLine(card: Pick<Card, "type" | "family">): string {
  return card.family ? `${card.type} — ${card.family}` : card.type;
}

/** Définitions SVG (dégradés des badges) à poser une fois par page, avant les cartes. */
export function GameCardDefs() {
  return (
    <>
      <PremiumDefs />
      <SnapDefs />
    </>
  );
}

/**
 * Une carte du jeu, dans le design retenu (n°70 : le 65 affiné, bandeau court), en carte normale
 * ou full art. La rareté ne se voit pour l'instant qu'en pied de carte.
 */
export function GameCard({
  card,
  imageUrl,
  layout = "normal",
  setSize,
  still = false,
  author,
}: {
  card: GameCardFields;
  imageUrl: string | null;
  layout?: TopLayout;
  /** Nombre de cartes du set, pour le numéro « 07/44 ». */
  setSize?: number;
  /** Carte figée (sans 3D ni animation), pour les planches de nombreuses cartes. */
  still?: boolean;
  /** Auteur de l'idée d'origine, en pied de carte (« idée de … »). */
  author?: string | null;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const data: CardData = {
    title: card.name || "Sans nom",
    flavor: card.flavor,
    effect: card.effectText,
    tag: card.family ?? card.type,
    // Les designs ne connaissent que 4 raretés ; épique, SR et SSR passent par `finish`.
    rarity:
      card.rarity === "epic"
        ? "rare"
        : card.rarity === "sr" || card.rarity === "ssr"
          ? "legendary"
          : card.rarity,
    cost: card.cost,
    power: card.power,
    imageUrl,
    imageFrame: card.imageFrame,
    author: author ?? undefined,
    // Hors set, pas de numéro : la carte est dans la réserve.
    serial:
      card.number === null
        ? "Réserve"
        : [card.setCode, setSize ? `${pad(card.number)}/${pad(setSize)}` : pad(card.number)]
            .filter(Boolean)
            .join(" "),
  };
  const face = (
    <FinalCard
      card={data}
      layout={layout}
      finish={card.rarity}
      band="court"
      typeLine={typeLine(card)}
      gameFooter
    />
  );
  return still ? <div className="tcg-still">{face}</div> : face;
}
