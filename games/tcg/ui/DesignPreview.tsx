import type { ReactNode } from "react";
import { type DesignId, designNumber } from "../src/designs";
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
import {
  SNAP_FINISH_LABELS,
  SnapCard as SnapVariant,
  SnapDefs,
  type SnapFinish,
  type SnapStyle,
} from "./snap";
import {
  ArcanesFull,
  BalatroCard,
  CosmicAurora,
  DuelCard,
  NeonSign,
  Potomon,
  SnapDepth,
  SnapInfinity,
  SnapSculpted,
  TarotCard,
  TaverneArch,
} from "./v2";
import { Captioned, type EffectSet, MixCard, type MixDesign } from "./v3";

const MIX: Partial<Record<DesignId, MixDesign>> = {
  "mix-verre": "verre",
  "mix-serti": "serti",
  "mix-plaque": "plaque",
};
const EFFECTS: Partial<Record<DesignId, EffectSet>> = {
  "effets-metaux": "metaux",
  "effets-gemmes": "gemmes",
  "effets-lumiere": "lumiere",
  "effets-cosmique": "cosmique",
};
const STAGE = "radial-gradient(ellipse at 50% 0%, #2a2f55 0%, #12142a 55%, #07080f 100%)";

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
  "snap-gold-spot": "goldspot",
  "snap-cosmic-frame": "cosmicframe",
  "snap-watercolor-frame": "watercolorframe",
};
const VARIANTS: SnapStyle[] = ["neon", "glitch", "prism", "goldspot"];
const LADDER: SnapFinish[] = ["common", "uncommon", "rare", "legendary", "sr", "ssr"];

/** Les designs premium montrent 3 finitions : peu commune, rare, légendaire. */
const SHOWCASE = ["uncommon", "rare", "legendary"] as const;

function showcase(cards: CardData[], designId: DesignId): CardData[] {
  return trio(cards, designId).map((c, i) => ({ ...c, rarity: SHOWCASE[i] ?? c.rarity }));
}

function PremiumBoard({ zoom, children }: { zoom: number; children: ReactNode }) {
  return (
    <Board zoom={zoom} background={STAGE}>
      {children}
    </Board>
  );
}

/** Carte n° i du lot, en boucle (un indice négatif reboucle aussi). */
function pick(cards: CardData[], i: number): CardData {
  const n = cards.length;
  const card = cards[((i % n) + n) % n];
  if (!card) throw new Error("Lot de cartes vide.");
  return card;
}

/** Trois cartes du lot, différentes d'un design à l'autre quand le lot est assez grand. */
function trio(cards: CardData[], designId: DesignId): CardData[] {
  const start = (designNumber(designId) - 1) * 3;
  return [0, 1, 2].map((i) => pick(cards, start + i));
}

const withImage = (cards: CardData[]) => cards.filter((c) => c.imageUrl);

type Props = {
  designId: DesignId;
  cards: CardData[];
  /** Réduction CSS (`zoom`) de la planche, pour en voir une entière d'un coup d'œil. */
  zoom?: number;
};

/**
 * Aperçu d'une proposition de design, rempli avec un lot de cartes (les idées de la boîte, ou des
 * exemples fictifs). `cards` ne doit pas être vide.
 */
export function DesignPreview({ designId, cards, zoom = 1 }: Props) {
  return (
    <div style={{ zoom }}>
      <Sheet designId={designId} cards={cards} zoom={zoom} />
    </div>
  );
}

/** La planche elle-même ; `zoom` est transmis aux cartes pour que l'agrandissement le compense. */
function Sheet({ designId, cards, zoom }: Required<Props>) {
  const pictured = withImage(cards).length > 0 ? withImage(cards) : cards;
  switch (designId) {
    case "pixel":
      return (
        <Board zoom={zoom} background="#12142a">
          {trio(cards, designId).map((c, i) => (
            <PixelCard key={i} card={c} />
          ))}
        </Board>
      );
    case "comics":
      return (
        <Board zoom={zoom} background="#f4ecd8">
          {trio(cards, designId).map((c, i) => (
            <ComicsCard key={i} card={c} index={i} />
          ))}
        </Board>
      );
    case "fantasy":
      return (
        <Board zoom={zoom} background="#1b1410">
          {trio(cards, designId).map((c, i) => (
            <FantasyCard key={i} card={c} />
          ))}
        </Board>
      );
    case "minimal":
      return (
        <Board zoom={zoom} background="#e9e9ec">
          {trio(pictured, designId).map((c, i) => (
            <MinimalCard key={i} card={c} />
          ))}
        </Board>
      );
    case "polaroid":
      return (
        <Board zoom={zoom} background="#c9a77c">
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
        <Board zoom={zoom} background="#12142a">
          <PixelLocationCard card={location} />
          <PixelFullArtCard card={{ ...legendary, rarity: "legendary" }} />
          <PixelCard card={fusion} label={`${fusion.tag} · Fusion`} />
        </Board>
      );
    }
    case "snap":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "hearth":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          {showcase(pictured, designId).map((c, i) => (
            <HearthCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "poke":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          {showcase(cards, designId).map((c, i) => (
            <PokeCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "magic":
      return (
        <PremiumBoard zoom={zoom}>
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
    case "snap-gold-spot":
    case "snap-cosmic-frame":
    case "snap-watercolor-frame":
      return (
        <PremiumBoard zoom={zoom}>
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapVariant key={i} card={c} style={SNAP_STYLES[designId]} />
          ))}
        </PremiumBoard>
      );
    case "snap-edition":
      return (
        <PremiumBoard zoom={zoom}>
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapVariant key={i} card={c} edition />
          ))}
        </PremiumBoard>
      );
    case "snap-raretes-v2": {
      const card = pick(pictured, 0);
      return (
        <Board
          zoom={zoom}
          wrap
          background="radial-gradient(ellipse at 50% 0%, #2a2f55 0%, #12142a 55%, #07080f 100%)"
        >
          <SnapDefs />
          {LADDER.map((finish) => (
            <SnapVariant key={finish} card={card} finish={finish} edition />
          ))}
        </Board>
      );
    }
    case "snap-variantes": {
      const card = pick(pictured, 0);
      return (
        <Board
          zoom={zoom}
          wrap
          background="radial-gradient(ellipse at 50% 0%, #2a2f55 0%, #12142a 55%, #07080f 100%)"
        >
          <SnapDefs />
          {VARIANTS.map((style) => (
            <SnapVariant key={style} card={card} style={style} finish="rare" edition />
          ))}
        </Board>
      );
    }
    case "hearth-snap":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <HearthCard key={i} card={c} snapBadges />
          ))}
        </PremiumBoard>
      );
    case "magic-snap":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(cards, designId).map((c, i) => (
            <MagicCard key={i} card={c} snapBadges />
          ))}
        </PremiumBoard>
      );
    case "snap-v2-sculpte":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapSculpted key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "snap-v3-infini":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapInfinity key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "snap-v4-profondeur":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <SnapDepth key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "arcanes-v2":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <ArcanesFull key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "taverne-v2":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <TaverneArch key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "potomon":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <Potomon key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "cosmique-v3":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <CosmicAurora key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "neon-v2":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <NeonSign key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "essai-duel":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <DuelCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "essai-tarot":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <TarotCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "essai-balatro":
      return (
        <PremiumBoard zoom={zoom}>
          <PremiumDefs />
          <SnapDefs />
          {showcase(pictured, designId).map((c, i) => (
            <BalatroCard key={i} card={c} />
          ))}
        </PremiumBoard>
      );
    case "mix-verre":
    case "mix-serti":
    case "mix-plaque": {
      // Le design seul : rareté commune, sans effet, en carte normale et en full art.
      const card = pick(pictured, 0);
      const design = MIX[designId] ?? "verre";
      return (
        <Board zoom={zoom} wrap background={STAGE}>
          <PremiumDefs />
          <SnapDefs />
          <Captioned label="Normale">
            <MixCard card={card} design={design} layout="normal" finish="common" />
          </Captioned>
          <Captioned label="Full art">
            <MixCard card={card} design={design} layout="fullart" finish="common" />
          </Captioned>
        </Board>
      );
    }
    case "effets-metaux":
    case "effets-gemmes":
    case "effets-lumiere":
    case "effets-cosmique": {
      // Les effets seuls : le même design, des 6 raretés, en carte normale puis en full art.
      const card = pick(pictured, 0);
      const effects = EFFECTS[designId] ?? "metaux";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["normal", "fullart"] as const).map((layout) => (
            <Board key={layout} zoom={zoom} wrap background={STAGE}>
              <PremiumDefs />
              <SnapDefs />
              {LADDER.map((finish) => (
                <Captioned
                  key={finish}
                  label={`${SNAP_FINISH_LABELS[finish]}${layout === "fullart" ? " · full art" : ""}`}
                >
                  <MixCard
                    card={card}
                    design="verre"
                    layout={layout}
                    effects={effects}
                    finish={finish}
                  />
                </Captioned>
              ))}
            </Board>
          ))}
        </div>
      );
    }
    case "raretes-v3": {
      const card = pick(pictured, 0);
      return (
        <Board
          zoom={zoom}
          wrap
          background="radial-gradient(ellipse at 50% 0%, #2a2f55 0%, #12142a 55%, #07080f 100%)"
        >
          <SnapDefs />
          {LADDER.map((finish) => (
            <SnapSculpted
              key={finish}
              card={card}
              finish={finish}
              signed={finish === "sr" || finish === "ssr"}
            />
          ))}
        </Board>
      );
    }
    case "snap-raretes": {
      const card = pick(pictured, 0);
      return (
        <Board
          zoom={zoom}
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
        <Board zoom={zoom} background="#12142a">
          <PixelCard card={{ ...card, rarity: "common" }} />
          <PixelCard card={{ ...card, rarity: "uncommon" }} />
          <PixelCard card={{ ...card, rarity: "rare" }} />
          <PixelFullArtCard card={{ ...card, rarity: "legendary" }} />
        </Board>
      );
    }
  }
}
