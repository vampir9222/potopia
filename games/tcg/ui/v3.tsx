import type { CSSProperties, ReactNode } from "react";
import { type CardData, font } from "./cards";
import { faction, PremiumArt } from "./premium";
import { Cost, Power, Ring, SNAP_FINISH_LABELS, type SnapFinish } from "./snap";
import { Art, FLOW, fill, GEM, Layer, METAL, R, SET_FILL, Shell } from "./v2";

/*
 * Troisième vague : le mélange des deux designs retenus, Arcanes V2 (plein cadre, barres en verre
 * fumé) et Raretés V3 (cadre sculpté, badges sertis, SR et SSR signées).
 *
 * Deux choses séparées, votées dans deux onglets :
 * - le design (MixDesign), en carte normale (illustration dans une fenêtre) et en full art ;
 * - les effets de rareté (EffectSet), posés par-dessus. La rareté d'une carte ne change jamais
 *   et n'influence pas ses stats : elle ne change que ces effets.
 *
 * Tout est visible d'emblée : aucun texte n'apparaît au survol.
 */

export type MixDesign = "verre" | "serti" | "plaque";
export type MixLayout = "normal" | "fullart";
export type EffectSet = "metaux" | "gemmes" | "lumiere" | "cosmique";

const BRONZE =
  "linear-gradient(145deg, #f0d4a2 0%, #a5773f 30%, #4a3118 60%, #d2a467 82%, #2a1a0b 100%)";
const DARK_STEEL =
  "linear-gradient(145deg, #7c8494 0%, #2c303a 35%, #0f1015 65%, #4a505e 85%, #121318 100%)";
const PRISM = "conic-gradient(from 210deg, #ff6ab5, #ffd36a, #7dffb0, #6ad5ff, #b88bff, #ff6ab5)";
const NEBULA =
  "linear-gradient(160deg, #e5d8ff 0%, #7a4dff 35%, #24135c 60%, #1d6f86 85%, #bfe9ff 100%)";
/** Épaisseur du cadre : la carte full art a un cadre fin, pour laisser plus de place à l'image. */
const FRAME = 12;
const FRAME_FULL = 7;

type Look = {
  /** Fond du cadre et des sertissages. */
  frame: string;
  /** Liseré intérieur coloré (gemmes), ou rien. */
  edge?: string;
  /** Couleurs du liseré d'énergie qui tourne (lumière), ou rien. */
  flow?: string;
  prism: boolean;
  holo: boolean;
  shine: boolean;
  etched: boolean;
  lenti: boolean;
  signed: boolean;
  /** Classe du nom (or, chrome) ou rien. */
  name?: string;
  /** Aurore et étoiles autour de la carte, qui débordent du cadre (cosmique). */
  cosmic: boolean;
};

/** Ce que la rareté ajoute à la carte, selon le jeu d'effets. */
function lookOf(effects: EffectSet, finish: SnapFinish): Look {
  const high = finish === "sr" || finish === "ssr";
  const shared = {
    holo: finish === "rare" || high,
    shine: finish === "legendary" || finish === "ssr",
    etched: finish === "sr",
    lenti: finish === "ssr",
    signed: high,
    cosmic: false,
    name:
      finish === "legendary" ? "tcg-gold-text" : finish === "ssr" ? "tcg-chrome-text" : undefined,
  };
  if (effects === "gemmes") {
    const edge =
      finish === "legendary"
        ? METAL.legendary
        : finish === "sr"
          ? METAL.sr
          : finish === "ssr"
            ? PRISM
            : GEM[finish];
    return { ...shared, frame: BRONZE, edge, prism: false };
  }
  if (effects === "lumiere") {
    return {
      ...shared,
      frame: DARK_STEEL,
      flow: finish === "common" ? undefined : FLOW[finish],
      prism: false,
    };
  }
  if (effects === "cosmique") {
    // Le cosmique, réservé aux hautes raretés : l'image reste intacte, l'aurore vit autour.
    const cosmic = finish === "legendary" || high;
    return {
      ...shared,
      frame: finish === "ssr" ? NEBULA : METAL[finish],
      prism: false,
      lenti: false,
      cosmic,
    };
  }
  return { ...shared, frame: METAL[finish], prism: finish === "ssr" };
}

/** Plaque de nom gravée, sertie dans le métal du cadre (Raretés V3). */
function Plate({ card, look, size = 22 }: { card: CardData; look: Look; size?: number }) {
  const shape = "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)";
  return (
    <div style={{ clipPath: shape, padding: 3, background: look.frame }}>
      <div
        style={{
          clipPath: shape,
          background: "linear-gradient(#1a1d2e, #07080f)",
          padding: "6px 16px 5px",
          textAlign: "center",
        }}
      >
        <div
          className={look.name}
          style={{
            fontFamily: font("snap", "Impact, sans-serif"),
            fontSize: card.title.length > 16 ? size - 5 : size,
            lineHeight: 1,
            textTransform: "uppercase",
            color: look.name ? undefined : "#fff",
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.title}
        </div>
      </div>
    </div>
  );
}

/**
 * Verre fumé des Arcanes, teinté par la famille de la carte. En full art il laisse voir l'image ;
 * en carte normale il est opaque : l'image reste dans sa fenêtre.
 */
function glass(card: CardData, layout: MixLayout): CSSProperties {
  const f = faction(card.tag);
  const full = layout === "fullart";
  return {
    background: full ? "rgb(12 10 8 / 0.64)" : "linear-gradient(#1d1f2b, #12131b)",
    backdropFilter: full ? "blur(5px)" : undefined,
    border: `1px solid ${f.light}88`,
    borderRadius: 10,
    color: "#f4ecdc",
  };
}

/** Parchemin ivoire (variante « plaque ») : encre sombre, lisible sur n'importe quelle image. */
function parchment(layout: MixLayout): CSSProperties {
  return {
    background:
      layout === "fullart"
        ? "linear-gradient(rgb(246 238 220 / 0.9), rgb(232 220 192 / 0.9))"
        : "linear-gradient(#f6eedc, #e6d8b6)",
    border: "1px solid #8a6d3b",
    borderRadius: 8,
    color: "#2a1f10",
    boxShadow: "inset 0 0 12px rgb(120 90 40 / 0.25)",
  };
}

/** Ligne de type des Arcanes : famille et gemme de rareté. */
function TypeLine({
  card,
  finish,
  style,
  big = false,
}: {
  card: CardData;
  finish: SnapFinish;
  style: CSSProperties;
  big?: boolean;
}) {
  const size = big ? 20 : 15;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        ...style,
      }}
    >
      <span style={{ fontFamily: font("magic", "serif"), fontWeight: 700, fontSize: 12.5 }}>
        Créature — {card.tag}
      </span>
      <span
        aria-label={SNAP_FINISH_LABELS[finish]}
        style={{
          width: size,
          height: size,
          clipPath: "polygon(50% 0, 100% 30%, 82% 100%, 18% 100%, 0 30%)",
          background: SET_FILL[finish],
          filter: big ? "drop-shadow(0 0 4px rgb(255 255 255 / 0.6))" : undefined,
        }}
      />
    </div>
  );
}

/** Effet et texte d'ambiance, toujours affichés. */
function TextBox({ card, style }: { card: CardData; style: CSSProperties }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        fontFamily: font("fantasy-text", "serif"),
        fontSize: 13.5,
        lineHeight: "16px",
        overflow: "hidden",
        ...style,
      }}
    >
      <div>{card.effect}</div>
      {card.flavor && (
        <div style={{ fontStyle: "italic", fontSize: 12.5, marginTop: 6, opacity: 0.85 }}>
          {card.flavor}
        </div>
      )}
    </div>
  );
}

function Footer({ card, finish, color }: { card: CardData; finish: SnapFinish; color: string }) {
  return (
    <Layer
      z={20}
      style={{
        left: 24,
        right: 24,
        bottom: 17,
        fontFamily: font("franklin", "sans-serif"),
        fontSize: 8.5,
        letterSpacing: 0.6,
        color,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {card.serial ?? "—"} · {SNAP_FINISH_LABELS[finish]} · Idée de {card.author ?? "?"}
    </Layer>
  );
}

/** Badge serti dans le métal du cadre (rond pour le coût, hexagone pour la puissance). */
function Setting({
  look,
  hex = false,
  children,
}: {
  look: Look;
  hex?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: 4,
        background: look.frame,
        borderRadius: hex ? undefined : "50%",
        clipPath: hex ? "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" : undefined,
        boxShadow: hex ? undefined : "0 4px 10px rgb(0 0 0 / 0.6)",
      }}
    >
      <div style={{ margin: -4 }}>{children}</div>
    </div>
  );
}

/** Zone de l'illustration : toute la carte en full art, une fenêtre en carte normale. */
function artBox(design: MixDesign, layout: MixLayout): CSSProperties {
  if (layout === "fullart") return { ...fill, borderRadius: R };
  const top = design === "verre" ? FRAME : design === "serti" ? 58 : 60;
  const height = design === "verre" ? 228 : design === "serti" ? 172 : 190;
  return {
    position: "absolute",
    left: FRAME + 2,
    right: FRAME + 2,
    top: top + 2,
    height,
    borderRadius: 10,
    overflow: "hidden",
  };
}

/**
 * Carte du mélange 39 × 44 : un design (verre, serti, plaque), une mise en page (normale ou full
 * art) et un jeu d'effets de rareté.
 */
export function MixCard({
  card,
  design,
  layout,
  effects = "metaux",
  finish = card.rarity,
}: {
  card: CardData;
  design: MixDesign;
  layout: MixLayout;
  effects?: EffectSet;
  finish?: SnapFinish;
}) {
  const look = lookOf(effects, finish);
  const full = layout === "fullart";
  const box = artBox(design, layout);
  const g = glass(card, layout);
  const fw = full ? FRAME_FULL : FRAME;
  const ink = design === "plaque" ? parchment(layout) : g;

  return (
    <Cosmic on={look.cosmic}>
      <Shell
        card={card}
        shadow={
          look.cosmic ? "0 24px 46px rgb(0 0 0 / 0.6), 0 0 34px rgb(140 90 255 / 0.5)" : undefined
        }
      >
        {/* Fond de la carte normale, sous la fenêtre d'illustration. */}
        {!full && (
          <div
            aria-hidden
            style={{
              ...fill,
              borderRadius: R,
              background:
                design === "plaque"
                  ? "linear-gradient(#2a2117, #16110b)"
                  : "linear-gradient(#1b1e2b, #0b0c13)",
            }}
          />
        )}
        {full ? (
          <Art card={card} />
        ) : (
          <div style={{ ...box, background: "#0b0d18" }}>
            <PremiumArt card={card} />
          </div>
        )}
        {/* SSR lenticulaire : l'image bascule toute seule en néon, sans survol. */}
        {look.lenti && (
          <div className="tcg-lenti-auto" style={{ ...box, overflow: "hidden" }}>
            <div
              style={{
                ...fill,
                filter: "saturate(1.8) hue-rotate(170deg) contrast(1.15) brightness(0.9)",
              }}
            >
              <PremiumArt card={card} />
            </div>
            <div className="tcg-lenti-lines" />
          </div>
        )}
        {full && (
          <div
            aria-hidden
            style={{
              ...fill,
              borderRadius: R,
              background:
                "linear-gradient(to top, rgb(6 7 18 / 0.75) 0%, rgb(6 7 18 / 0.2) 40%, transparent 60%)",
            }}
          />
        )}
        {look.holo && <div className="tcg-holo" style={full ? undefined : box} />}
        {look.etched && <div className="tcg-etched" style={full ? undefined : box} />}

        {/* Cadre sculpté (44) : métal, biseau, liseré intérieur. */}
        <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
          {look.prism ? (
            <div className="tcg-prism" style={{ "--prism-w": `${fw}px` } as CSSProperties} />
          ) : (
            <Ring background={look.frame} width={fw} />
          )}
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
              inset: fw,
              borderRadius: R - 10,
              boxShadow: "0 0 0 2px rgb(0 0 0 / 0.75), inset 0 0 18px rgb(0 0 0 / 0.5)",
            }}
          />
          {look.edge && (
            <Ring
              background={look.edge}
              width={3}
              style={{
                inset: fw + 2,
                borderRadius: R - 12,
                filter: "drop-shadow(0 0 4px #fff8)",
              }}
            />
          )}
          {look.flow && (
            <div className="tcg-flow" style={{ "--flow": look.flow } as CSSProperties} />
          )}
          {!full && (
            <div
              style={{
                ...box,
                boxShadow: `0 0 0 2px #0d0d0d, 0 0 0 3.5px ${faction(card.tag).light}, 0 0 0 5px #0d0d0d`,
              }}
            />
          )}
          {look.cosmic && (
            <div
              className="tcg-breathe"
              style={{
                position: "absolute",
                inset: fw,
                borderRadius: R - 10,
                boxShadow:
                  "inset 0 0 22px rgb(150 110 255 / 0.65), inset 0 0 6px rgb(120 220 255 / 0.6)",
              }}
            />
          )}
          {look.shine && <div className="tcg-shine" />}
        </Layer>

        {/* Coût en haut à gauche ; puissance en haut à droite, ou en bas à droite pour « serti ». */}
        <Layer z={56} style={{ left: -4, top: -4 }}>
          <Setting look={look}>
            <Cost value={card.cost} />
          </Setting>
        </Layer>
        <Layer
          z={56}
          style={
            design === "serti"
              ? { right: -2, bottom: -2, transform: "scale(0.85)", transformOrigin: "100% 100%" }
              : { right: -4, top: -3 }
          }
        >
          <Setting look={look} hex>
            <Power value={card.power} />
          </Setting>
        </Layer>

        {design === "verre" && (
          <>
            <Layer z={46} style={{ left: 30, right: 30, top: full ? 196 : 222 }}>
              <Plate card={card} look={look} />
            </Layer>
            <Layer z={30} style={{ left: 20, right: 20, top: full ? 246 : 272 }}>
              <TypeLine
                card={card}
                finish={finish}
                big={effects === "gemmes"}
                style={{ ...g, height: 24 }}
              />
            </Layer>
            <Layer z={30} style={{ left: 20, right: 20, top: full ? 276 : 302, bottom: 34 }}>
              <TextBox card={card} style={{ ...g, height: "100%" }} />
            </Layer>
          </>
        )}

        {design === "serti" && (
          <>
            <Layer
              z={30}
              style={{
                left: 66,
                right: 20,
                top: 18,
                height: 34,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                ...g,
              }}
            >
              <span
                className={look.name}
                style={{
                  fontFamily: font("magic", "serif"),
                  fontWeight: 800,
                  fontSize: 16,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: look.name ? undefined : "#f4ecdc",
                }}
              >
                {card.title}
              </span>
            </Layer>
            <Layer z={30} style={{ left: 20, right: 20, top: full ? 236 : 240 }}>
              <TypeLine
                card={card}
                finish={finish}
                big={effects === "gemmes"}
                style={{ ...g, height: 28 }}
              />
            </Layer>
            <Layer z={30} style={{ left: 20, right: 20, top: full ? 270 : 274, bottom: 46 }}>
              <TextBox card={card} style={{ ...g, height: "100%" }} />
            </Layer>
          </>
        )}

        {design === "plaque" && (
          <>
            <Layer z={46} style={{ left: 60, right: 60, top: 14 }}>
              <Plate card={card} look={look} size={18} />
            </Layer>
            <Layer z={30} style={{ left: 20, right: 20, top: full ? 248 : 258 }}>
              <TypeLine
                card={card}
                finish={finish}
                big={effects === "gemmes"}
                style={{ ...ink, height: 24 }}
              />
            </Layer>
            <Layer z={30} style={{ left: 20, right: 20, top: full ? 278 : 288, bottom: 34 }}>
              <TextBox card={card} style={{ ...ink, height: "100%" }} />
            </Layer>
          </>
        )}

        {/* SR et SSR : signées par l'auteur de l'idée (44). */}
        {look.signed && (
          <Layer
            z={40}
            style={{
              right: 26,
              top: design === "verre" ? (full ? 150 : 176) : design === "serti" ? 184 : 204,
              transform: "rotate(-8deg)",
              pointerEvents: "none",
            }}
          >
            <span
              className="tcg-gold-text"
              style={{
                fontFamily: font("hand", "cursive"),
                fontWeight: 700,
                fontSize: 26,
                filter: "drop-shadow(0 1px 1px #000)",
              }}
            >
              {card.author ?? "Potopia"}
            </span>
          </Layer>
        )}

        <Footer
          card={card}
          finish={finish}
          color={design === "plaque" && !full ? "#cdbb93" : "#d8d2c4"}
        />
      </Shell>
    </Cosmic>
  );
}

/** Aurore et étoiles derrière la carte (effet cosmique), qui dépassent un peu de ses bords. */
function Cosmic({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return children;
  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden
        className="tcg-aurora"
        style={{ position: "absolute", inset: -16, borderRadius: 48, pointerEvents: "none" }}
      />
      <div
        aria-hidden
        className="tcg-stars"
        style={{ position: "absolute", inset: -20, pointerEvents: "none" }}
      />
      {children}
    </div>
  );
}

/** Étiquette sous une carte de la planche (« Normale », « Full art », rareté…). */
export function Captioned({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure
      style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
    >
      {children}
      <figcaption
        style={{
          fontFamily: font("franklin", "sans-serif"),
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "#c9cde0",
        }}
      >
        {label}
      </figcaption>
    </figure>
  );
}
