import type { DesignId } from "../src/designs";
import {
  Board,
  type CardData,
  ComicsCard,
  FantasyCard,
  MinimalCard,
  PixelCard,
  PixelFullArtCard,
  PixelLocationCard,
  PolaroidCard,
} from "./cards";

const ORDER: DesignId[] = [
  "pixel",
  "comics",
  "fantasy",
  "minimal",
  "polaroid",
  "speciales",
  "raretes",
];

/** Carte n° i du lot, en boucle. */
function pick(cards: CardData[], i: number): CardData {
  const card = cards[i % cards.length];
  if (!card) throw new Error("Lot de cartes vide.");
  return card;
}

/** Trois cartes du lot, différentes d'un design à l'autre quand le lot est assez grand. */
function trio(cards: CardData[], designId: DesignId): CardData[] {
  const start = ORDER.indexOf(designId) * 3;
  return [0, 1, 2].map((i) => pick(cards, start + i));
}

const withImage = (cards: CardData[]) => cards.filter((c) => c.imageUrl);

/**
 * Aperçu d'une proposition de design, rempli avec un lot de cartes (les idées de la boîte, ou des
 * exemples fictifs). `cards` ne doit pas être vide.
 */
export function DesignPreview({ designId, cards }: { designId: DesignId; cards: CardData[] }) {
  const pictured = withImage(cards).length > 0 ? withImage(cards) : cards;
  switch (designId) {
    case "pixel":
      return (
        <Board background="#12142a">
          {trio(cards, designId).map((c, i) => (
            <PixelCard key={i} card={c} />
          ))}
        </Board>
      );
    case "comics":
      return (
        <Board background="#f4ecd8">
          {trio(cards, designId).map((c, i) => (
            <ComicsCard key={i} card={c} index={i} />
          ))}
        </Board>
      );
    case "fantasy":
      return (
        <Board background="#1b1410">
          {trio(cards, designId).map((c, i) => (
            <FantasyCard key={i} card={c} />
          ))}
        </Board>
      );
    case "minimal":
      return (
        <Board background="#e9e9ec">
          {trio(pictured, designId).map((c, i) => (
            <MinimalCard key={i} card={c} />
          ))}
        </Board>
      );
    case "polaroid":
      return (
        <Board background="#c9a77c">
          {trio(pictured, designId).map((c, i) => (
            <PolaroidCard key={i} card={c} index={i} />
          ))}
        </Board>
      );
    case "speciales": {
      const location = cards.find((c) => !c.imageUrl) ?? pick(cards, 0);
      const legendary = pictured.find((c) => c.rarity === "legendary") ?? pick(pictured, 0);
      const fusion = cards.find((c) => c.rarity === "uncommon" && c !== location) ?? pick(cards, 1);
      return (
        <Board background="#12142a">
          <PixelLocationCard card={location} />
          <PixelFullArtCard card={{ ...legendary, rarity: "legendary" }} />
          <PixelCard card={fusion} label={`${fusion.tag} · Fusion`} />
        </Board>
      );
    }
    case "raretes": {
      const card = pick(pictured, 0);
      return (
        <Board background="#12142a">
          <PixelCard card={{ ...card, rarity: "common" }} />
          <PixelCard card={{ ...card, rarity: "uncommon" }} />
          <PixelCard card={{ ...card, rarity: "rare" }} />
          <PixelFullArtCard card={{ ...card, rarity: "legendary" }} />
        </Board>
      );
    }
  }
}
