import type { CSSProperties } from "react";
import { type CardData, font } from "./cards";
import { faction, PremiumArt } from "./premium";
import { Cost, Power, Ring, SNAP_FINISH_LABELS } from "./snap";
import { Art, fill, Layer, METAL, R, SET_FILL, Shell } from "./v2";

/*
 * Quatrième vague, d'après les avis sur le 48 : le titre en haut, et une seule grille pour la carte
 * normale et la full art. Titre, coût (mana), puissance, ligne de type et encadré de texte sont aux
 * mêmes coordonnées dans les deux ; seule l'illustration change (fenêtre ou carte entière), et en
 * full art les encadrés deviennent transparents.
 *
 * Le 48 plaisait pour la carte normale, sauf le cadre autour de l'image, qui semblait posé
 * au-dessus de la bordure de la carte. Chaque proposition traite donc la fenêtre autrement
 * (creusée, fondue, gravée…). Toutes existent avec la puissance en haut à droite ou en bas à droite.
 *
 * Montrées sans effet de rareté (métal commun) : les effets se votent à part.
 */

export type TopLayout = "normal" | "fullart";
export type PowerSpot = "top" | "bottom";

/** Traitement de la fenêtre d'illustration de la carte normale. */
type Window =
  | "creusee" // enfoncée dans la carte : ombre intérieure, aucun cadre
  | "fondue" // l'image se fond dans le panneau du bas, sans bord
  | "gravee" // biseau inversé : taillée dans la carte
  | "continue" // cadre du même métal que la bordure, à son niveau
  | "large" // d'un bord à l'autre du cadre, sans marge
  | "arche" // haut en arche, creusée
  | "coins" // coins coupés, creusée
  | "douce"; // arrondie, simple ombre légère

/** Matière des encadrés (titre, type, texte) de la carte normale. */
type Panel = "nuit" | "givre" | "parchemin" | "ardoise";

/** Forme du titre. */
type Title = "barre" | "plaque" | "bandeau";

export type TopStyle = {
  window: Window;
  panel: Panel;
  title: Title;
  /** Cadre fin (7 px) au lieu du cadre sculpté (12 px). */
  thin?: boolean;
};

/** Les douze propositions de la vague, par id de design. */
export const TOP_STYLES = {
  "haut-creuse": { window: "creusee", panel: "nuit", title: "barre" },
  "haut-fondu": { window: "fondue", panel: "nuit", title: "barre" },
  "haut-grave": { window: "gravee", panel: "nuit", title: "barre" },
  "haut-continu": { window: "continue", panel: "nuit", title: "barre" },
  "haut-large": { window: "large", panel: "nuit", title: "barre" },
  "haut-arche": { window: "arche", panel: "nuit", title: "barre" },
  "haut-coins": { window: "coins", panel: "nuit", title: "barre" },
  "haut-givre": { window: "creusee", panel: "givre", title: "barre" },
  "haut-parchemin": { window: "creusee", panel: "parchemin", title: "barre" },
  "haut-plaque": { window: "creusee", panel: "nuit", title: "plaque" },
  "haut-bandeau": { window: "creusee", panel: "ardoise", title: "bandeau" },
  "haut-fin": { window: "douce", panel: "nuit", title: "barre", thin: true },
} as const satisfies Record<string, TopStyle>;

export type TopStyleId = keyof typeof TOP_STYLES;

/* ── Grille commune : identique en carte normale et en full art ── */
const FRAME = 12;
const FRAME_THIN = 7;
const SIDE = 18;
const TITLE = { top: 16, height: 36, inset: 62 };
const ART = { top: 60, height: 172 };
const TYPE = { top: 240, height: 26 };
const TEXT = { top: 272, bottom: 40 };
const BADGE = 0.86;

const FINISH = "common";
const METAL_FRAME = METAL[FINISH];

/** Fond et texte d'un encadré : opaque en carte normale, transparent en full art. */
function panelStyle(card: CardData, panel: Panel, layout: TopLayout): CSSProperties {
  const f = faction(card.tag);
  const full = layout === "fullart";
  if (panel === "parchemin") {
    return {
      background: full
        ? "linear-gradient(rgb(246 238 220 / 0.82), rgb(232 220 192 / 0.82))"
        : "linear-gradient(#f6eedc, #e6d8b6)",
      backdropFilter: full ? "blur(4px)" : undefined,
      border: "1px solid #8a6d3b",
      borderRadius: 8,
      color: "#2a1f10",
    };
  }
  if (panel === "givre") {
    return {
      background: full ? "rgb(255 255 255 / 0.18)" : "linear-gradient(#e9eef5, #c9d2de)",
      backdropFilter: full ? "blur(8px) saturate(1.2)" : undefined,
      border: "1px solid rgb(255 255 255 / 0.55)",
      borderRadius: 10,
      color: full ? "#ffffff" : "#18202c",
      textShadow: full ? "0 1px 2px rgb(0 0 0 / 0.7)" : undefined,
    };
  }
  if (panel === "ardoise") {
    return {
      background: full ? "rgb(30 34 44 / 0.55)" : "linear-gradient(#2c313d, #1b1f28)",
      backdropFilter: full ? "blur(5px)" : undefined,
      border: "1px solid rgb(255 255 255 / 0.14)",
      borderRadius: 8,
      color: "#eef1f6",
    };
  }
  return {
    background: full ? "rgb(12 10 8 / 0.58)" : "linear-gradient(#1d1f2b, #12131b)",
    backdropFilter: full ? "blur(5px)" : undefined,
    border: `1px solid ${f.light}88`,
    borderRadius: 10,
    color: "#f4ecdc",
  };
}

/** Fond de la carte normale autour de la fenêtre (assorti aux encadrés). */
function cardBackground(panel: Panel): string {
  if (panel === "givre") return "linear-gradient(#7f8a9a, #4d5664)";
  if (panel === "parchemin") return "linear-gradient(#2a2117, #16110b)";
  if (panel === "ardoise") return "linear-gradient(#3a404d, #22262f)";
  return "linear-gradient(#1b1e2b, #0b0c13)";
}

/** Rectangle de la fenêtre d'illustration (carte normale). */
function windowBox(style: TopStyle): CSSProperties {
  const frame = style.thin ? FRAME_THIN : FRAME;
  const inset = style.window === "large" ? frame : SIDE;
  const shape: CSSProperties =
    style.window === "arche"
      ? { borderRadius: "110px 110px 10px 10px / 70px 70px 10px 10px" }
      : style.window === "coins"
        ? {
            clipPath:
              "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
          }
        : style.window === "large"
          ? { borderRadius: 0 }
          : { borderRadius: style.window === "douce" ? 14 : 8 };
  return {
    position: "absolute",
    left: inset,
    right: inset,
    top: ART.top,
    height: ART.height,
    overflow: "hidden",
    ...shape,
  };
}

/** Ce qui donne du relief à la fenêtre : jamais un cadre posé au-dessus de la bordure. */
function windowRelief(style: TopStyle): CSSProperties | null {
  switch (style.window) {
    case "creusee":
    case "arche":
    case "coins":
    case "large":
      // Enfoncée : ombre portée vers l'intérieur, en haut surtout.
      return { boxShadow: "inset 0 6px 12px rgb(0 0 0 / 0.75), inset 0 -2px 6px rgb(0 0 0 / 0.5)" };
    case "gravee":
      // Biseau inversé : ombre en haut à gauche, lumière en bas à droite.
      return {
        boxShadow:
          "inset 3px 3px 0 rgb(0 0 0 / 0.65), inset -2px -2px 0 rgb(255 255 255 / 0.35), inset 0 0 14px rgb(0 0 0 / 0.4)",
      };
    case "douce":
      return { boxShadow: "inset 0 0 10px rgb(0 0 0 / 0.45)" };
    default:
      return null;
  }
}

function TitleBlock({
  card,
  style,
  layout,
}: {
  card: CardData;
  style: TopStyle;
  layout: TopLayout;
}) {
  if (style.title === "plaque") {
    const shape = "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)";
    return (
      <Layer z={30} style={{ left: TITLE.inset - 4, right: TITLE.inset - 4, top: TITLE.top }}>
        <div style={{ clipPath: shape, padding: 3, background: METAL_FRAME }}>
          <div
            style={{
              clipPath: shape,
              height: TITLE.height - 6,
              display: "grid",
              placeItems: "center",
              background:
                layout === "fullart" ? "rgb(10 12 24 / 0.6)" : "linear-gradient(#1a1d2e, #07080f)",
              backdropFilter: layout === "fullart" ? "blur(5px)" : undefined,
            }}
          >
            <TitleText card={card} snap />
          </div>
        </div>
      </Layer>
    );
  }
  const band = style.title === "bandeau";
  const frame = style.thin ? FRAME_THIN : FRAME;
  return (
    <Layer
      z={30}
      style={{
        left: band ? frame : TITLE.inset,
        right: band ? frame : TITLE.inset,
        top: band ? frame : TITLE.top,
        height: band ? TITLE.top + TITLE.height - frame : TITLE.height,
        display: "grid",
        placeItems: "center",
        padding: band ? `0 ${TITLE.inset - frame}px` : "0 12px",
        ...panelStyle(card, style.panel, layout),
        ...(band ? { borderRadius: `${R - frame}px ${R - frame}px 0 0`, borderTop: 0 } : {}),
      }}
    >
      <TitleText card={card} />
    </Layer>
  );
}

function TitleText({ card, snap = false }: { card: CardData; snap?: boolean }) {
  return (
    <span
      style={{
        fontFamily: snap ? font("snap", "Impact, sans-serif") : font("magic", "serif"),
        fontWeight: 800,
        fontSize: snap ? 19 : 17,
        textTransform: snap ? "uppercase" : undefined,
        color: snap ? "#fff" : undefined,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
      }}
    >
      {card.title}
    </span>
  );
}

/**
 * Carte de la quatrième vague : un style, une mise en page (normale ou full art) et la place de la
 * puissance (en haut à droite ou en bas à droite).
 */
export function TopCard({
  card,
  style,
  layout,
  power,
}: {
  card: CardData;
  style: TopStyle;
  layout: TopLayout;
  power: PowerSpot;
}) {
  const full = layout === "fullart";
  const frame = style.thin ? FRAME_THIN : FRAME;
  const panel = panelStyle(card, style.panel, layout);
  const box = windowBox(style);
  const relief = windowRelief(style);
  const bottomPower = power === "bottom";

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
            style={{ ...fill, borderRadius: R, background: cardBackground(style.panel) }}
          />
          <div
            style={{
              ...box,
              background: "#0b0d18",
              ...(style.window === "fondue"
                ? {
                    WebkitMaskImage: "linear-gradient(to bottom, #000 72%, transparent 100%)",
                    maskImage: "linear-gradient(to bottom, #000 72%, transparent 100%)",
                    height: ART.height + 14,
                  }
                : {}),
            }}
          >
            <PremiumArt card={card} />
            {relief && <div aria-hidden style={{ ...fill, ...relief, borderRadius: "inherit" }} />}
          </div>
          {style.window === "continue" && (
            // Cadre du même métal que la bordure, à son niveau (même biseau, même épaisseur visuelle).
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: SIDE - 5,
                right: SIDE - 5,
                top: ART.top - 5,
                height: ART.height + 10,
                borderRadius: 12,
                padding: 5,
                background: METAL_FRAME,
                WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
                boxShadow:
                  "inset 1px 1px 0 rgb(255 255 255 / 0.5), inset -1px -1px 0 rgb(0 0 0 / 0.5)",
              }}
            />
          )}
        </>
      )}

      {/* Bordure de la carte : métal et biseau, le seul relief qui dépasse. */}
      <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
        <Ring background={METAL_FRAME} width={frame} />
        <div
          style={{
            ...fill,
            borderRadius: R,
            boxShadow:
              "inset 2px 2px 0 rgb(255 255 255 / 0.55), inset -2px -2px 0 rgb(0 0 0 / 0.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: frame,
            borderRadius: R - frame + 2,
            boxShadow: "0 0 0 1.5px rgb(0 0 0 / 0.7), inset 0 0 16px rgb(0 0 0 / 0.45)",
          }}
        />
      </Layer>

      <TitleBlock card={card} style={style} layout={layout} />

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
            Créature — {card.tag}
          </span>
          <span
            aria-label={SNAP_FINISH_LABELS[FINISH]}
            style={{
              width: 15,
              height: 15,
              clipPath: "polygon(50% 0, 100% 30%, 82% 100%, 18% 100%, 0 30%)",
              background: SET_FILL[FINISH],
            }}
          />
        </div>
      </Layer>

      <Layer z={30} style={{ left: SIDE, right: SIDE, top: TEXT.top, bottom: TEXT.bottom }}>
        <div
          style={{
            height: "100%",
            padding: bottomPower ? "8px 40px 8px 12px" : "8px 12px",
            fontFamily: font("fantasy-text", "serif"),
            fontSize: 13.5,
            lineHeight: "16px",
            overflow: "hidden",
            ...panel,
          }}
        >
          <div>{card.effect}</div>
          {card.flavor && (
            <div style={{ fontStyle: "italic", fontSize: 12.5, marginTop: 6, opacity: 0.85 }}>
              {card.flavor}
            </div>
          )}
        </div>
      </Layer>

      <Layer
        z={20}
        style={{
          left: SIDE + 4,
          right: bottomPower ? 70 : SIDE + 4,
          bottom: 17,
          fontFamily: font("franklin", "sans-serif"),
          fontSize: 8.5,
          letterSpacing: 0.6,
          color: style.panel === "givre" && !full ? "#eef2f7" : "#d8d2c4",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {card.serial ?? "—"} · {SNAP_FINISH_LABELS[FINISH]} · Idée de {card.author ?? "?"}
      </Layer>

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
          zIndex: 5,
          scale: String(BADGE),
          ...(bottomPower
            ? { right: -2, bottom: -2, transformOrigin: "100% 100%" }
            : { right: -2, top: -2, transformOrigin: "100% 0" }),
        }}
      >
        <Power value={card.power} />
      </Layer>
    </Shell>
  );
}

/** Les quatre versions d'une proposition, dans l'ordre de la planche. */
export const TOP_VARIANTS: { layout: TopLayout; power: PowerSpot; label: string }[] = [
  { layout: "normal", power: "bottom", label: "Normale · puissance en bas" },
  { layout: "fullart", power: "bottom", label: "Full art · puissance en bas" },
  { layout: "normal", power: "top", label: "Normale · puissance en haut" },
  { layout: "fullart", power: "top", label: "Full art · puissance en haut" },
];
