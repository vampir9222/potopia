import { type CardData, font } from "./cards";
import { PremiumArt } from "./premium";
import { Cost, Power, Ring, SNAP_FINISH_LABELS, type SnapFinish } from "./snap";
import { Art, fill, Layer, R, Shell } from "./v2";
import {
  BADGE,
  cardBackground,
  FRAME_THIN,
  panelStyle,
  SIDE,
  TEXT,
  TITLE,
  TitleText,
  type TopLayout,
  type TopStyle,
  TYPE,
  windowBox,
  windowRelief,
} from "./v4";

/*
 * Cinquième vague : on affine le gagnant de la quatrième, le 65 (titre en bandeau, encadrés
 * ardoise, puissance en bas), avec le cadre fin du 66. Une carte normale et une full art.
 *
 * Changements par rapport au 65 :
 * - le bandeau du titre est au même plan que la bordure et glisse dessous : il épouse le cadre
 *   au pixel près, coins compris ;
 * - l'effet en haut de l'encadré, la description en italique, un peu plus petite, en bas ;
 * - pas de symbole d'édition : la rareté se verra à la bordure et aux effets ;
 * - en pied de carte, le numéro et la rareté, avec des étoiles à partir de la légendaire
 *   (1 pour la légendaire, 2 pour la SR, 3 pour la SSR) ;
 * - le cadre prend la couleur de la rareté (`RARITY_FRAME`), uni et sans effet de lumière d'un
 *   côté, pour une épaisseur égale tout autour ;
 * - bandeau court (n°70) : titre à la hauteur du mana, centré dans la place que le mana laisse.
 *
 * Le 65 et le 66 gardent leur rendu (`ui/v4.tsx`) : seules des exportations y ont été ajoutées.
 */

/**
 * Raretés des cartes du jeu : celles des anciennes planches (`SnapFinish`), plus l'épique, entre
 * la rare et la légendaire.
 */
export type CardFinish = SnapFinish | "epic";
const FINISH_LABELS: Record<CardFinish, string> = { ...SNAP_FINISH_LABELS, epic: "Épique" };

const STYLE: TopStyle = { window: "creusee", panel: "ardoise", title: "bandeau", thin: true };
const FRAME = FRAME_THIN;
/**
 * Couleur du cadre selon la rareté : c'est elle qui montre la rareté. Teintes unies (ou dégradé
 * conique centré, pour la SR et la SSR) : le cadre a la même épaisseur apparente sur ses quatre
 * côtés, là où un dégradé en biais assombrissait le bord droit.
 */
export const RARITY_FRAME: Record<CardFinish, string> = {
  common: "#a7aebb",
  uncommon: "#3dbb78",
  rare: "#4688f0",
  epic: "#9b55ec",
  legendary: "#e0ac34",
  sr: "conic-gradient(from 0deg at 50% 50%, #ffe0f0, #dccfff, #c9f1ff, #fff1d2, #ffe0f0)",
  ssr: "conic-gradient(from 0deg at 50% 50%, #ff6ab5, #ffd36a, #7dffb0, #6ad5ff, #b88bff, #ff6ab5)",
};
/** Liseré clair, le même tout autour du cadre (aucun effet de lumière venant d'un côté). */
const FRAME_EDGE = "inset 0 0 0 1px rgb(255 255 255 / 0.45)";

/** Étoiles de rareté : aucune jusqu'à la rare, puis une par palier. */
export const RARITY_STARS: Record<CardFinish, number> = {
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 0,
  legendary: 1,
  sr: 2,
  ssr: 3,
};

/**
 * Forme du bandeau du titre autour du mana (le n°67 est « plein ») :
 * - plein : tout le haut de la carte ; un coin du bandeau dépasse sous le mana, à gauche ;
 * - echancre : creusé en arc autour du mana, avec un liseré ; rien à gauche du mana ;
 * - serti : le mana est serti dans un anneau du métal de la bordure, qui recouvre le coin ;
 * - court : bandeau moins haut, le mana déborde en dessous ;
 * - aucun : pas de bandeau, le titre est posé sur la carte.
 */
export type BandShape = "plein" | "echancre" | "serti" | "court" | "aucun";

/** Centre et rayon du rond du mana (`Cost` réduit de `BADGE`, posé à -2 px du coin). */
const MANA = { x: -2 + 34 * BADGE, y: -2 + 33 * BADGE, r: 29.75 * BADGE };
/** Rayon de l'échancrure (4 px d'écart autour du mana) et de l'anneau serti. */
const NOTCH = MANA.r + 4.5;
const SOCKET = 34.5;

/**
 * Bandeau du titre : au plan de la bordure, dessiné juste avant elle, et prolongé de 2 px sous le
 * métal. Le bord visible est donc celui de la bordure elle-même.
 */
function Band({ card, layout, shape }: { card: CardData; layout: TopLayout; shape: BandShape }) {
  const under = 2;
  const left = FRAME - under;
  const top = FRAME - under;
  if (shape === "aucun") {
    return (
      <Layer
        z={30}
        style={{
          left: TITLE.inset,
          right: TITLE.inset,
          top: TITLE.top,
          height: TITLE.height,
          display: "grid",
          placeItems: "center",
          color: "#f4f1ea",
          textShadow: "0 1px 3px rgb(0 0 0 / 0.9), 0 0 10px rgb(0 0 0 / 0.6)",
        }}
      >
        <TitleText card={card} />
      </Layer>
    );
  }
  const cut = shape === "echancre" ? NOTCH : shape === "serti" ? SOCKET : 0;
  // Centre du mana dans le repère du bandeau.
  const cx = MANA.x - left;
  const cy = MANA.y - top;
  const mask = cut
    ? `radial-gradient(circle at ${cx}px ${cy}px, transparent ${cut}px, #000 ${cut + 0.5}px)`
    : undefined;
  const short = shape === "court";
  const height = (short ? 46 : TITLE.top + TITLE.height) - top;
  return (
    <Layer
      z={10}
      style={{
        left,
        right: left,
        top,
        height,
        display: "grid",
        placeItems: "center",
        // Bandeau court : le titre se centre dans la place laissée libre par le mana (à droite du
        // rond, jusqu'au cadre), à la hauteur du centre du mana.
        padding: short
          ? `${FRAME - top}px 22px 0 ${Math.round(MANA.x + MANA.r) + 2 - left}px`
          : `0 ${TITLE.inset - left}px`,
        overflow: "hidden",
        ...panelStyle(card, STYLE.panel, layout),
        border: 0,
        borderBottom: "1px solid rgb(255 255 255 / 0.14)",
        borderRadius: `${R - left}px ${R - left}px 0 0`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {shape === "echancre" && (
        // Liseré le long de l'arc, comme le bord bas du bandeau.
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: cx - cut - 1,
            top: cy - cut - 1,
            width: 2 * (cut + 1),
            height: 2 * (cut + 1),
            borderRadius: "50%",
            border: "1px solid rgb(255 255 255 / 0.22)",
          }}
        />
      )}
      <TitleText card={card} />
    </Layer>
  );
}

/** Anneau de métal autour du mana, du métal de la bordure, rogné à la forme de la carte. */
function Socket({ finish }: { finish: CardFinish }) {
  return (
    <Layer z={10} style={{ ...fill, borderRadius: R, overflow: "hidden", pointerEvents: "none" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: MANA.x - SOCKET,
          top: MANA.y - SOCKET,
          width: 2 * SOCKET,
          height: 2 * SOCKET,
          borderRadius: "50%",
          background: RARITY_FRAME[finish],
          boxShadow: `${FRAME_EDGE}, 0 0 0 1.5px rgb(0 0 0 / 0.7)`,
        }}
      />
    </Layer>
  );
}

/** Pied de carte : numéro, puis rareté et ses étoiles. */
function Footer({ card, finish }: { card: CardData; finish: CardFinish }) {
  const stars = RARITY_STARS[finish];
  return (
    <Layer
      z={20}
      style={{
        left: SIDE + 4,
        right: 70,
        bottom: 15,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: font("franklin", "sans-serif"),
        fontSize: 9,
        letterSpacing: 0.6,
        color: "#d8d2c4",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{card.serial ?? "—"}</span>
      <span aria-hidden style={{ opacity: 0.5 }}>
        ·
      </span>
      <span>{FINISH_LABELS[finish]}</span>
      {stars > 0 && (
        <span
          role="img"
          aria-label={`${stars} étoile${stars > 1 ? "s" : ""}`}
          style={{
            color: "#ffd66b",
            fontSize: 11,
            letterSpacing: 1,
            textShadow: "0 0 4px rgb(255 190 60 / 0.7)",
          }}
        >
          {"★".repeat(stars)}
        </span>
      )}
    </Layer>
  );
}

/**
 * Carte de la cinquième vague, en carte normale ou full art. `finish` ne change que le pied de
 * carte : les effets de rareté se votent à part.
 */
export function FinalCard({
  card,
  layout,
  finish = "common",
  band = "plein",
  typeLine,
}: {
  card: CardData;
  layout: TopLayout;
  finish?: CardFinish;
  band?: BandShape;
  /** Ligne de type des vraies cartes (« Instrument — Grenouilles ») ; par défaut « Créature — tag ». */
  typeLine?: string;
}) {
  const full = layout === "fullart";
  const panel = panelStyle(card, STYLE.panel, layout);
  const relief = windowRelief(STYLE);

  return (
    <Shell card={card}>
      {full ? (
        <>
          <Art card={card} />
          {/* Assombrit le bas de l'image, pour la lisibilité des encadrés transparents. */}
          <div
            aria-hidden
            style={{
              ...fill,
              borderRadius: R,
              background:
                "linear-gradient(to top, rgb(6 7 18 / 0.6) 0%, rgb(6 7 18 / 0.1) 45%, transparent 60%), linear-gradient(to bottom, rgb(6 7 18 / 0.45) 0%, transparent 18%)",
            }}
          />
        </>
      ) : (
        <>
          <div
            aria-hidden
            style={{ ...fill, borderRadius: R, background: cardBackground(STYLE.panel) }}
          />
          <div style={{ ...windowBox(STYLE), background: "#0b0d18" }}>
            <PremiumArt card={card} />
            {relief && <div aria-hidden style={{ ...fill, ...relief, borderRadius: "inherit" }} />}
          </div>
        </>
      )}

      <Band card={card} layout={layout} shape={band} />

      {/* Bordure de la carte, après le bandeau : elle en recouvre le bord. */}
      <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
        <Ring background={RARITY_FRAME[finish]} width={FRAME} />
        <div
          style={{
            ...fill,
            borderRadius: R,
            boxShadow: FRAME_EDGE,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: FRAME,
            borderRadius: R - FRAME,
            boxShadow: "0 0 0 1.5px rgb(0 0 0 / 0.7), inset 0 0 16px rgb(0 0 0 / 0.45)",
          }}
        />
      </Layer>
      {band === "serti" && <Socket finish={finish} />}

      <Layer z={30} style={{ left: SIDE, right: SIDE, top: TYPE.top, height: TYPE.height }}>
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px",
            ...panel,
          }}
        >
          <span style={{ fontFamily: font("magic", "serif"), fontWeight: 700, fontSize: 12.5 }}>
            {typeLine ?? `Créature — ${card.tag}`}
          </span>
        </div>
      </Layer>

      <Layer z={30} style={{ left: SIDE, right: SIDE, top: TEXT.top, bottom: TEXT.bottom }}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "8px 40px 8px 12px",
            fontFamily: font("fantasy-text", "serif"),
            fontSize: 13.5,
            lineHeight: "16px",
            overflow: "hidden",
            ...panel,
          }}
        >
          <div>{card.effect}</div>
          {card.flavor && (
            <div
              style={{
                marginTop: "auto",
                paddingTop: 6,
                fontStyle: "italic",
                fontSize: 11.5,
                lineHeight: "14px",
                opacity: 0.8,
              }}
            >
              {card.flavor}
            </div>
          )}
        </div>
      </Layer>

      <Footer card={card} finish={finish} />

      {/* Coût et puissance en dernier : toujours au-dessus du reste, sans sertissage. */}
      <Layer
        z={80}
        style={{ left: -2, top: -2, zIndex: 5, scale: String(BADGE), transformOrigin: "0 0" }}
      >
        <Cost value={card.cost} />
      </Layer>
      <Layer
        z={80}
        style={{
          right: -2,
          bottom: -2,
          zIndex: 5,
          scale: String(BADGE),
          transformOrigin: "100% 100%",
        }}
      >
        <Power value={card.power} />
      </Layer>
    </Shell>
  );
}

/** La planche du n°67 : normale et full art, puis la carte dans chaque rareté. */
export const FINAL_VARIANTS: { layout: TopLayout; finish: CardFinish; label: string }[] = [
  { layout: "normal", finish: "common", label: "Normale · commune" },
  { layout: "fullart", finish: "common", label: "Full art · commune" },
  { layout: "normal", finish: "uncommon", label: "Peu commune" },
  { layout: "normal", finish: "rare", label: "Rare" },
  { layout: "normal", finish: "epic", label: "Épique" },
  { layout: "normal", finish: "legendary", label: "Légendaire ★" },
  { layout: "normal", finish: "sr", label: "SR ★★" },
  { layout: "normal", finish: "ssr", label: "SSR ★★★" },
];

/** Les variantes du bandeau autour du mana, par id de design (n°68 à 71). */
export const BAND_DESIGNS = {
  "final-echancre": "echancre",
  "final-serti": "serti",
  "final-court": "court",
  "final-sans-bandeau": "aucun",
} as const satisfies Record<string, BandShape>;
