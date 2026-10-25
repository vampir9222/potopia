import { Children, type CSSProperties, Fragment, isValidElement, type ReactNode } from "react";
import { Zoomable } from "./Zoomable";

export type CardRarity = "common" | "uncommon" | "rare" | "legendary";

/** Contenu d'une carte, quel que soit le design. */
export type CardData = {
  title: string;
  /** Texte d'ambiance (description de l'idée). */
  flavor: string | null;
  effect: string;
  /** Famille de la carte (personnes concernées, type…). */
  tag: string;
  rarity: CardRarity;
  cost: number;
  power: number;
  imageUrl: string | null;
  /** Auteur de l'idée, affiché par certains designs. */
  author?: string;
  /** Numéro dans la série (« 07/18 »), affiché par certains designs. */
  serial?: string;
};

export const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  legendary: "Légendaire",
};

/**
 * Polices des designs, fournies par la page sous forme de variables CSS (next/font côté app) :
 * --font-pixel, --font-pixel-text, --font-comic, --font-comic-text, --font-fantasy,
 * --font-fantasy-text, --font-grotesk, --font-hand, --font-round, et pour les designs premium
 * --font-snap, --font-franklin, --font-magic, --font-poke.
 */
export const font = (name: string, fallback: string) => `var(--font-${name}), ${fallback}`;

const W = 300;
const H = 420;

/** Illustration de la carte, ou un nuage pixel quand l'idée n'a pas d'image. */
export function Art({
  card,
  height,
  style,
  placeholder = "#2a6b2a",
}: {
  card: CardData;
  height: number | string;
  style?: CSSProperties;
  placeholder?: string;
}) {
  if (card.imageUrl) {
    return (
      <div style={{ height, overflow: "hidden", ...style }}>
        <img
          src={card.imageUrl}
          alt={card.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        height,
        background: placeholder,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <svg width="110" height="88" viewBox="0 0 20 16" shapeRendering="crispEdges" aria-hidden>
        <g fill="rgba(255,255,255,0.55)">
          <rect x="6" y="3" width="6" height="2" />
          <rect x="4" y="5" width="11" height="2" />
          <rect x="2" y="7" width="15" height="3" />
          <rect x="4" y="10" width="12" height="2" />
        </g>
      </svg>
    </div>
  );
}

/* ───────────────────────── 1. Pixel arcade ───────────────────────── */

const PIXEL_FRAME: Record<CardRarity, string> = {
  common: "#c9cde6",
  uncommon: "#5ccf9a",
  rare: "#8f7bff",
  legendary: "#e6b04e",
};
const PIXEL_BG: Record<CardRarity, string> = {
  common: "#1d2145",
  uncommon: "#1b2e2a",
  rare: "#241d45",
  legendary: "#2a2418",
};
const pixelShadow = (c: string) => `0 0 0 4px #0b0c1a, 0 0 0 8px ${c}, 0 0 0 12px #0b0c1a`;

function PixelBadge({ value, kind }: { value: number; kind: "cost" | "power" }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        background: kind === "cost" ? "#3a6df0" : "#ff8a1f",
        color: kind === "cost" ? "#eef0ff" : "#1a0d00",
        boxShadow: "0 0 0 3px #0b0c1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font("pixel", "monospace"),
        fontSize: 16,
      }}
      aria-label={kind === "cost" ? `Coût ${value}` : `Puissance ${value}`}
    >
      {value}
    </div>
  );
}

/** Liseré « reflet » des raretés rare et légendaire. */
function Foil({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background: `repeating-linear-gradient(115deg, transparent 0 28px, ${color} 28px 36px)`,
      }}
    />
  );
}

export function PixelCard({ card, label }: { card: CardData; label?: string }) {
  const frame = PIXEL_FRAME[card.rarity];
  const foil = card.rarity === "rare" || card.rarity === "legendary";
  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        background: PIXEL_BG[card.rarity],
        boxShadow: pixelShadow(frame),
        display: "flex",
        flexDirection: "column",
        padding: 12,
        gap: 8,
        color: "#eef0ff",
        fontFamily: font("pixel-text", "monospace"),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PixelBadge value={card.cost} kind="cost" />
        <div
          style={{
            flex: 1,
            fontFamily: font("pixel", "monospace"),
            fontSize: 10,
            lineHeight: "14px",
          }}
        >
          {card.title}
        </div>
        <PixelBadge value={card.power} kind="power" />
      </div>
      <div style={{ position: "relative" }}>
        <Art
          card={card}
          height={170}
          style={{
            boxShadow:
              card.rarity === "common"
                ? "0 0 0 3px #0b0c1a"
                : `0 0 0 3px #0b0c1a, 0 0 0 6px ${frame}`,
          }}
        />
        {foil && <Foil color="rgba(200,180,255,0.25)" />}
      </div>
      <div style={{ fontSize: 18, color: frame, textTransform: "uppercase" }}>
        {label ?? `${card.tag} · ${RARITY_LABELS[card.rarity]}`}
      </div>
      <div style={{ fontSize: 21, lineHeight: "20px", background: "#0b0c1a", padding: 8 }}>
        {card.effect}
      </div>
      {card.flavor && (
        <div style={{ fontSize: 18, lineHeight: "18px", color: "#8a90c8", overflow: "hidden" }}>
          « {card.flavor} »
        </div>
      )}
    </div>
  );
}

/** Légendaire plein cadre : l'image occupe toute la carte, le texte flotte dessus. */
export function PixelFullArtCard({ card }: { card: CardData }) {
  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        background: "#000",
        boxShadow: pixelShadow(PIXEL_FRAME.legendary),
        color: "#eef0ff",
        fontFamily: font("pixel-text", "monospace"),
      }}
    >
      <Art card={card} height="100%" style={{ position: "absolute", inset: 0 }} />
      <Foil color="rgba(255,215,120,0.2)" />
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <PixelBadge value={card.cost} kind="cost" />
        <PixelBadge value={card.power} kind="power" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          background: "rgba(11,12,26,0.9)",
          boxShadow: "0 0 0 3px #e6b04e",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ fontFamily: font("pixel", "monospace"), fontSize: 11, color: "#f3cf7e" }}>
          {card.title}
        </div>
        <div style={{ fontSize: 18, color: "#f3cf7e", textTransform: "uppercase" }}>
          {card.tag} · Légendaire · plein cadre
        </div>
        <div style={{ fontSize: 20, lineHeight: "19px" }}>{card.effect}</div>
      </div>
    </div>
  );
}

/** Carte de lieu : pas de coût ni de puissance, un effet qui s'applique à tout le lieu. */
export function PixelLocationCard({ card }: { card: CardData }) {
  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        background: "#2a2418",
        boxShadow: pixelShadow("#c7a25a"),
        display: "flex",
        flexDirection: "column",
        padding: 12,
        gap: 8,
        color: "#eef0ff",
        fontFamily: font("pixel-text", "monospace"),
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <div
          style={{
            background: "#c7a25a",
            color: "#1a1408",
            padding: "6px 8px",
            fontFamily: font("pixel", "monospace"),
            fontSize: 10,
            boxShadow: "0 0 0 3px #0b0c1a",
          }}
        >
          LIEU
        </div>
        <div style={{ fontFamily: font("pixel", "monospace"), fontSize: 11, textAlign: "right" }}>
          {card.title}
        </div>
      </div>
      <Art
        card={card}
        height={190}
        placeholder="#3b5a2a"
        style={{ boxShadow: "0 0 0 3px #0b0c1a" }}
      />
      <div style={{ fontSize: 18, color: "#e0c98a" }}>LIEU · DÉVOILÉ AU TOUR 1, 2 OU 3</div>
      <div style={{ fontSize: 21, lineHeight: "20px", background: "#0b0c1a", padding: 8 }}>
        {card.effect}
      </div>
      {card.flavor && (
        <div style={{ fontSize: 18, lineHeight: "18px", color: "#b9a77a" }}>« {card.flavor} »</div>
      )}
    </div>
  );
}

/* ───────────────────────── 2. Comics ───────────────────────── */

const COMICS_BG = ["#ffd400", "#8fd3ff", "#ffb27a"];

export function ComicsCard({ card, index = 0 }: { card: CardData; index?: number }) {
  const badge: CSSProperties = {
    position: "absolute",
    top: -16,
    width: 52,
    height: 52,
    border: "4px solid #111",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: font("comic", "cursive"),
    fontSize: 30,
  };
  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        position: "relative",
        background: COMICS_BG[index % COMICS_BG.length],
        border: "5px solid #111",
        borderRadius: 10,
        boxShadow: "8px 8px 0 #111",
        display: "flex",
        flexDirection: "column",
        padding: 10,
        gap: 8,
        color: "#111",
        fontFamily: font("comic-text", "sans-serif"),
      }}
    >
      <div
        style={{ ...badge, left: -16, borderRadius: "50%", background: "#2f6fe4" }}
        aria-label={`Coût ${card.cost}`}
      >
        {card.cost}
      </div>
      <div
        style={{ ...badge, right: -16, background: "#e8262b", transform: "rotate(45deg)" }}
        aria-label={`Puissance ${card.power}`}
      >
        <span style={{ transform: "rotate(-45deg)" }}>{card.power}</span>
      </div>
      <Art card={card} height={190} placeholder="#e8262b" style={{ border: "4px solid #111" }} />
      <div
        style={{
          alignSelf: "center",
          marginTop: -26,
          background: "#fff",
          border: "4px solid #111",
          borderRadius: 6,
          padding: "2px 14px",
          fontFamily: font("comic", "cursive"),
          fontSize: 26,
          letterSpacing: 1,
          textAlign: "center",
          maxWidth: 250,
        }}
      >
        {card.title}
      </div>
      <div
        style={{ fontSize: 13, fontWeight: 700, textAlign: "center", textTransform: "uppercase" }}
      >
        {card.tag} · {RARITY_LABELS[card.rarity]}
      </div>
      <div
        style={{
          background: "#fff",
          border: "3px solid #111",
          borderRadius: 6,
          padding: 8,
          fontSize: 15,
          lineHeight: "19px",
          fontWeight: 700,
        }}
      >
        {card.effect}
      </div>
      {card.flavor && (
        <div style={{ fontSize: 14, lineHeight: "17px", fontStyle: "italic" }}>
          « {card.flavor} »
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 3. Fantasy dorée ───────────────────────── */

const FANTASY_FRAME: Record<CardRarity, string> = {
  common: "#a89f92",
  uncommon: "#6fbf8a",
  rare: "#8f7bff",
  legendary: "#e6b04e",
};

export function FantasyCard({ card }: { card: CardData }) {
  const frame = FANTASY_FRAME[card.rarity];
  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        background: "#2b1d10",
        border: `3px solid ${frame}`,
        borderRadius: 14,
        padding: 7,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          background: "#f1e4c3",
          border: `2px solid ${frame}`,
          borderRadius: 9,
          display: "flex",
          flexDirection: "column",
          padding: 10,
          gap: 7,
          color: "#2b1d10",
          fontFamily: font("fantasy-text", "serif"),
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              background: "#2f5fb3",
              border: "2px solid #e6b04e",
              transform: "rotate(45deg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label={`Coût ${card.cost}`}
          >
            <span
              style={{
                transform: "rotate(-45deg)",
                fontFamily: font("fantasy", "serif"),
                fontWeight: 800,
                fontSize: 17,
                color: "#fff",
              }}
            >
              {card.cost}
            </span>
          </div>
          <div
            style={{
              fontFamily: font("fantasy", "serif"),
              fontWeight: 800,
              fontSize: 17,
              lineHeight: "20px",
              textAlign: "center",
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              width: 38,
              height: 42,
              flexShrink: 0,
              background: "#b5462b",
              border: "2px solid #e6b04e",
              borderRadius: "6px 6px 19px 19px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: font("fantasy", "serif"),
              fontWeight: 800,
              fontSize: 17,
              color: "#fff",
            }}
            aria-label={`Puissance ${card.power}`}
          >
            {card.power}
          </div>
        </div>
        <Art
          card={card}
          height={168}
          placeholder="#6b4e22"
          style={{ border: "2px solid #8a6326", borderRadius: 6 }}
        />
        <div
          style={{
            textAlign: "center",
            fontFamily: font("fantasy", "serif"),
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: 2,
            color: "#6b4e22",
            textTransform: "uppercase",
          }}
        >
          {card.tag} · {RARITY_LABELS[card.rarity]}
        </div>
        <div
          style={{
            borderTop: "1px solid #c9a35a",
            borderBottom: "1px solid #c9a35a",
            padding: "6px 2px",
            fontSize: 16,
            lineHeight: "19px",
            textAlign: "center",
          }}
        >
          {card.effect}
        </div>
        {card.flavor && (
          <div style={{ fontStyle: "italic", fontSize: 15, textAlign: "center", color: "#6b4e22" }}>
            « {card.flavor} »
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 4. Minimal photo ───────────────────────── */

export function MinimalCard({ card }: { card: CardData }) {
  const pill: CSSProperties = {
    borderRadius: 999,
    padding: "4px 12px",
    fontWeight: 700,
    fontSize: 15,
  };
  return (
    <div
      style={{
        width: W,
        height: H,
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        background: "#222",
        color: "#fff",
        fontFamily: font("grotesk", "sans-serif"),
      }}
    >
      <Art
        card={card}
        height="100%"
        placeholder="#3a3a44"
        style={{ position: "absolute", inset: 0 }}
      />
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          right: 14,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ ...pill, background: "rgba(10,10,14,0.78)" }}>◆ {card.cost}</div>
        <div style={{ ...pill, background: "#ff6a2b", color: "#1a0a00" }}>{card.power} ✦</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(10,10,14,0.82)",
          padding: "14px 16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{ fontSize: 11, letterSpacing: 1.5, color: "#b9b9c6", textTransform: "uppercase" }}
        >
          {card.tag} · {RARITY_LABELS[card.rarity]}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: "24px" }}>{card.title}</div>
        <div style={{ fontSize: 14, lineHeight: "18px", color: "#e6e6ee" }}>{card.effect}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          background: FANTASY_FRAME[card.rarity],
        }}
      />
    </div>
  );
}

/* ───────────────────────── 5. Polaroid entre potes ───────────────────────── */

const TAPES = ["rgba(255,240,170,0.8)", "rgba(190,230,255,0.8)", "rgba(255,200,215,0.8)"];
const TILTS = [-2, 1.5, -1];

export function PolaroidCard({ card, index = 0 }: { card: CardData; index?: number }) {
  const dot: CSSProperties = {
    position: "absolute",
    top: 8,
    width: 34,
    height: 34,
    borderRadius: "50%",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 18,
    border: "2px solid #fff",
  };
  return (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        position: "relative",
        background: "#fffdf7",
        transform: `rotate(${TILTS[index % TILTS.length]}deg)`,
        boxShadow: "0 6px 14px rgba(40,25,10,0.35)",
        padding: "14px 14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        color: "#2a2420",
        fontFamily: font("round", "sans-serif"),
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -12,
          left: 110,
          width: 80,
          height: 24,
          background: TAPES[index % TAPES.length],
          transform: "rotate(3deg)",
        }}
      />
      <div style={{ position: "relative" }}>
        <Art card={card} height={200} placeholder="#9a8670" />
        <div style={{ ...dot, left: 8, background: "#3d6fd6" }} aria-label={`Coût ${card.cost}`}>
          {card.cost}
        </div>
        <div
          style={{ ...dot, right: 8, background: "#f26b21" }}
          aria-label={`Puissance ${card.power}`}
        >
          {card.power}
        </div>
      </div>
      <div
        style={{
          fontFamily: font("hand", "cursive"),
          fontWeight: 700,
          fontSize: 30,
          lineHeight: "30px",
        }}
      >
        {card.title}
      </div>
      <div style={{ fontSize: 14, lineHeight: "18px" }}>{card.effect}</div>
      {card.flavor && (
        <div
          style={{
            fontFamily: font("hand", "cursive"),
            fontSize: 19,
            lineHeight: "19px",
            color: "#6b5d50",
            overflow: "hidden",
          }}
        >
          « {card.flavor} »
        </div>
      )}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#8a7d70",
        }}
      >
        <span>
          {card.tag} · {RARITY_LABELS[card.rarity]}
        </span>
        {card.author && <span>idée de {card.author}</span>}
      </div>
    </div>
  );
}

/**
 * Fond d'un plateau de présentation (3 ou 4 cartes côte à côte ; sur mobile, les cartes passent à la
 * ligne, classe `tcg-board` de tcg.css).
 */
export function Board({
  background,
  wrap = false,
  zoom = 1,
  children,
}: {
  background: string;
  /** Plusieurs rangées au lieu d'un défilement horizontal. */
  wrap?: boolean;
  /** Réduction CSS (`zoom`) appliquée au plateau par la page, compensée quand on agrandit une carte. */
  zoom?: number;
  children: ReactNode;
}) {
  return (
    <div
      className={wrap ? "tcg-board tcg-board-wrap" : "tcg-board"}
      style={{
        background,
        padding: 40,
        display: "flex",
        flexWrap: wrap ? "wrap" : undefined,
        justifyContent: wrap ? "center" : undefined,
        gap: 48,
        overflowX: "auto",
        borderRadius: 12,
      }}
    >
      {Children.map(children, (child) =>
        // Les définitions SVG (marquées `tcgDefs`, sans rendu) ne sont pas des cartes : pas de zoom.
        isValidElement(child) &&
        typeof child.type !== "string" &&
        child.type !== Fragment &&
        !(child.type as { tcgDefs?: boolean }).tcgDefs ? (
          <Zoomable zoom={zoom}>{child}</Zoomable>
        ) : (
          child
        ),
      )}
    </div>
  );
}
