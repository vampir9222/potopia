import type { ReactNode } from "react";
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
import { HearthCard, MagicCard, PokeCard, PremiumDefs, SnapCard } from "./premium";
import { SnapCard as SnapVariant, SnapDefs, type SnapFinish, type SnapStyle } from "./snap";

const ORDER: DesignId[] = [
  "pixel",
  "comics",
  "fantasy",
  "minimal",
  "polaroid",
  "speciales",
  "raretes",
  "snap",
  "hearth",
  "poke",
  "magic",
  "snap-classic",
  "snap-ink",
  "snap-neon",
  "snap-pixel",
  "snap-prism",
  "snap-raretes",
  "snap-gold",
  "snap-kawaii",
  "snap-popart",
  "snap-glitch",
  "snap-watercolor",
  "snap-sketch",
  "snap-cosmic",
  "snap-borderless",
  "snap-stained",
  "snap-theme",
];

const SNAP_STYLES: Partial<Record<DesignId, SnapStyle>> = {
  "snap-classic": "classic",
  "snap-ink": "ink",
  "snap-neon": "neon",
  "snap-pixel": "pixel",
  "snap-prism": "prism",
  "snap-gold": "gold",
  "snap-kawaii": "kawaii",
  "snap-popart": "popart",
  "snap-glitch": "glitch",
  "snap-watercolor": "watercolor",
  "snap-sketch": "sketch",
  "snap-cosmic": "cosmic",
  "snap-borderless": "borderless",
  "snap-stained": "stained",
  "snap-theme": "theme",
};
const LADDER: SnapFinish[] = ["common", "uncommon", "rare", "legendary", "sr", "ssr"];

/** Les designs premium montrent 3 finitions : peu commune, rare, légendaire. */
const SHOWCASE = ["uncommon", "rare", "legendary"] as const;

function showcase(cards: CardData[], designId: DesignId): CardData[] {
  return trio(cards, designId).map((c, i) => ({ ...c, rarity: SHOWCASE[i] ?? c.rarity }));
}

function PremiumBoard({ children }: { children: ReactNode }) {
  return (
    <Board background="radial-gradient(ellipse at 50% 0%, #2a2f55 0%, #12142a 55%, #07080f 100%)">
      {children}
    </Board>
  );
}

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
    case "snap":
      return (
        <PremiumBoard>
          <PremiumDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "hearth":
      return (
        <PremiumBoard>
          <PremiumDefs />
          {showcase(pictured, designId).map((c, i) => (
            <HearthCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "poke":
      return (
        <PremiumBoard>
          <PremiumDefs />
          {showcase(cards, designId).map((c, i) => (
            <PokeCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "magic":
      return (
        <PremiumBoard>
          <PremiumDefs />
          {showcase(cards, designId).map((c, i) => (
            <MagicCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "snap-classic":
    case "snap-ink":
    case "snap-neon":
    case "snap-pixel":
    case "snap-prism":
    case "snap-gold":
    case "snap-kawaii":
    case "snap-popart":
    case "snap-glitch":
    case "snap-watercolor":
    case "snap-sketch":
    case "snap-cosmic":
    case "snap-borderless":
    case "snap-stained":
    case "snap-theme":
      return (
        <PremiumBoard>
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapVariant key={i} card={c} style={SNAP_STYLES[designId]} />
          ))}
        </PremiumBoard>
      );
    case "snap-raretes": {
      const card = pick(pictured, 0);
      return (
        <Board
          wrap
          background="radial-gradient(ellipse at 50% 0%, #2a2f55 0%, #12142a 55%, #07080f 100%)"
        >
          <SnapDefs />
          {LADDER.map((finish) => (
            <SnapVariant key={finish} card={card} finish={finish} />
          ))}
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
