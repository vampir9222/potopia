import type { CSSProperties, ReactNode } from "react";
import { Art, type CardData, type CardRarity, font, RARITY_LABELS } from "./cards";
import { Cost, Power } from "./snap";
import { Tilt } from "./Tilt";

/*
 * Designs « premium », inspirés des grands TCG (Marvel Snap, Hearthstone, Pokémon, Magic) :
 * cadres travaillés, gemmes et badges en SVG, holo et reflet qui suivent le pointeur (tcg.css).
 * La rareté ne change que la finition (cadre, holo, paillettes, symbole), jamais les stats.
 */

const W = 300;
const H = 420;

/** Couleur de « faction », tirée de la famille de la carte : même famille, même couleur. */
const FACTIONS = [
  { base: "#d4462e", light: "#ffb08a", dark: "#5e140b", name: "Feu" },
  { base: "#2f7fd8", light: "#a8d6ff", dark: "#0c2a58", name: "Eau" },
  { base: "#3f9d3a", light: "#b6ec92", dark: "#143d17", name: "Plante" },
  { base: "#6b48a8", light: "#cdb6ff", dark: "#24153f", name: "Ombre" },
  { base: "#c99a2e", light: "#fff0a8", dark: "#5a420c", name: "Lumière" },
] as const;

export function faction(tag: string) {
  let h = 0;
  for (const ch of tag.toLowerCase()) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return FACTIONS[h % FACTIONS.length] ?? FACTIONS[0];
}

/** Illustration de la carte ; sans image, un emblème aux couleurs de la famille. */
export function PremiumArt({ card, round = false }: { card: CardData; round?: boolean }) {
  if (card.imageUrl) return <Art card={card} height="100%" />;
  const f = faction(card.tag);
  return (
    <div
      style={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: round ? "50%" : undefined,
        background: `radial-gradient(circle at 50% 38%, ${f.light} 0%, ${f.base} 42%, ${f.dark} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-conic-gradient(from 0deg at 50% 38%, rgb(255 255 255 / 0.10) 0deg 6deg, transparent 6deg 18deg)`,
        }}
      />
      <span
        aria-hidden
        style={{
          position: "relative",
          fontFamily: font("fantasy", "serif"),
          fontWeight: 800,
          fontSize: 120,
          lineHeight: 1,
          color: "rgb(255 255 255 / 0.9)",
          textShadow: `0 4px 0 ${f.dark}, 0 0 30px rgb(255 255 255 / 0.6)`,
        }}
      >
        {card.title.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <span
        style={{
          position: "absolute",
          bottom: round ? 30 : 10,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 9,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgb(255 255 255 / 0.85)",
          fontFamily: font("franklin", "sans-serif"),
          fontWeight: 700,
        }}
      >
        Illustration à venir
      </span>
    </div>
  );
}

/** Couches de finition selon la rareté : holo, paillettes et liseré animé. */
function Finish({
  rarity,
  orbit,
  holo = true,
}: {
  rarity: CardRarity;
  orbit: string;
  holo?: boolean;
}) {
  return (
    <>
      {holo && (rarity === "rare" || rarity === "legendary") && <div className="tcg-holo" />}
      {rarity === "legendary" && <div className="tcg-sparkle" />}
      {(rarity === "rare" || rarity === "legendary") && (
        <div className="tcg-orbit" style={{ "--orbit": orbit } as CSSProperties} />
      )}
      <div className="tcg-glare" />
    </>
  );
}

/** Dégradés SVG partagés par les badges (identifiants globaux, définis une fois par plateau). */
export function PremiumDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <linearGradient id="tcg-g-mana" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6f2ff" />
          <stop offset="0.35" stopColor="#4fb2ff" />
          <stop offset="0.7" stopColor="#1650c8" />
          <stop offset="1" stopColor="#0a1f63" />
        </linearGradient>
        <linearGradient id="tcg-g-power" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.4" stopColor="#ff9b2e" />
          <stop offset="1" stopColor="#a73300" />
        </linearGradient>
        <linearGradient id="tcg-g-blood" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffb3a6" />
          <stop offset="0.4" stopColor="#e2322a" />
          <stop offset="1" stopColor="#5c0805" />
        </linearGradient>
        <linearGradient id="tcg-g-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset="0.3" stopColor="#e2b04a" />
          <stop offset="0.55" stopColor="#7a5014" />
          <stop offset="0.8" stopColor="#f2cf73" />
          <stop offset="1" stopColor="#9a6a1c" />
        </linearGradient>
        <linearGradient id="tcg-g-ribbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8c88a" />
          <stop offset="0.5" stopColor="#b88a4a" />
          <stop offset="1" stopColor="#6e4b1f" />
        </linearGradient>
        <linearGradient id="tcg-g-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#9aa7b3" />
          <stop offset="0.7" stopColor="#e9eef2" />
          <stop offset="1" stopColor="#6b7782" />
        </linearGradient>
        <linearGradient id="tcg-g-mythic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe2a6" />
          <stop offset="0.45" stopColor="#ff7a2e" />
          <stop offset="1" stopColor="#a8190f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
PremiumDefs.tcgDefs = true;

/** Chiffre en SVG avec contour sombre, lisible sur n'importe quel fond. */
function Num({
  x,
  y,
  size,
  children,
  family,
}: {
  x: number;
  y: number;
  size: number;
  children: ReactNode;
  family: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontFamily={family}
      fill="#fff"
      stroke="#0b0b14"
      strokeWidth={size / 7}
      paintOrder="stroke"
      style={{ fontWeight: 800 }}
    >
      {children}
    </text>
  );
}

/* ───────────────────────── Snap : art plein cadre ───────────────────────── */

const SNAP_FRAME: Record<CardRarity, string> = {
  common: "#8a93a6",
  uncommon: "#3fcf8e",
  rare: "#9b7bff",
  legendary: "#f6c445",
};

export function SnapCard({ card }: { card: CardData }) {
  const frame = SNAP_FRAME[card.rarity];
  return (
    <Tilt radius={22}>
      <div
        style={{
          width: W,
          height: H,
          position: "relative",
          borderRadius: 22,
          overflow: "hidden",
          background: "#0b0d18",
          boxShadow: "0 22px 44px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(0 0 0 / 0.6)",
          color: "#fff",
        }}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          <PremiumArt card={card} />
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 30%, transparent 40%, rgb(0 0 0 / 0.55) 100%), linear-gradient(to top, rgb(6 7 18 / 0.97) 0%, rgb(6 7 18 / 0.75) 28%, transparent 52%)",
          }}
        />
        <Finish rarity={card.rarity} orbit={frame} />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 22,
            boxShadow: `inset 0 0 0 2px rgb(255 255 255 / 0.5), inset 0 0 0 7px ${frame}, inset 0 0 0 9px rgb(0 0 0 / 0.7), inset 0 0 30px rgb(0 0 0 / 0.6)`,
          }}
        />
        <svg
          width="74"
          height="74"
          viewBox="0 0 74 74"
          style={{ position: "absolute", left: 4, top: 4 }}
          role="img"
          aria-label={`Coût ${card.cost}`}
        >
          <polygon
            points="37,4 66,20 66,54 37,70 8,54 8,20"
            fill="url(#tcg-g-mana)"
            stroke="#fff"
            strokeWidth="3"
          />
          <polygon points="37,4 66,20 37,37 8,20" fill="rgb(255 255 255 / 0.25)" />
          <polygon points="37,37 66,54 37,70" fill="rgb(0 0 0 / 0.2)" />
          <Num x={37} y={39} size={34} family={font("snap", "Impact, sans-serif")}>
            {card.cost}
          </Num>
        </svg>
        <svg
          width="78"
          height="78"
          viewBox="0 0 78 78"
          style={{ position: "absolute", right: 2, top: 2 }}
          role="img"
          aria-label={`Puissance ${card.power}`}
        >
          <polygon
            points="39,3 47,22 67,14 59,33 76,42 57,49 63,70 44,60 39,76 33,60 14,70 20,49 2,42 19,33 11,14 31,22"
            fill="url(#tcg-g-power)"
            stroke="#fff"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <Num x={39} y={41} size={32} family={font("snap", "Impact, sans-serif")}>
            {card.power}
          </Num>
        </svg>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 82, textAlign: "center" }}>
          <div
            style={{
              fontFamily: font("snap", "Impact, sans-serif"),
              fontSize: card.title.length > 16 ? 24 : 30,
              lineHeight: 1,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              textShadow: "0 3px 0 #000, 0 0 18px rgb(0 0 0 / 0.9)",
              WebkitTextStroke: "1px rgb(0 0 0 / 0.7)",
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              letterSpacing: 2.5,
              color: frame,
              fontWeight: 700,
              textTransform: "uppercase",
              fontFamily: font("franklin", "sans-serif"),
            }}
          >
            {card.tag} · {RARITY_LABELS[card.rarity]}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            minHeight: 54,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            background: "rgb(12 14 32 / 0.72)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgb(255 255 255 / 0.16)",
            borderRadius: 12,
            padding: "8px 10px",
            fontFamily: font("franklin", "sans-serif"),
            fontSize: 12.5,
            lineHeight: "16px",
            color: "#e9ecff",
          }}
        >
          {card.effect}
        </div>
      </div>
    </Tilt>
  );
}

/* ───────────────────────── Hearthstone : portrait ovale, ruban ───────────────────────── */

const HEARTH_GEM: Record<CardRarity, string> = {
  common: "#e9ecef",
  uncommon: "#3d8bff",
  rare: "#a155ff",
  legendary: "#ff8a1e",
};

export function HearthCard({
  card,
  snapBadges = false,
}: {
  card: CardData;
  /** Rond bleu et hexagone jaune façon Snap à la place du cristal et de la goutte. */
  snapBadges?: boolean;
}) {
  const gem = HEARTH_GEM[card.rarity];
  const legendary = card.rarity === "legendary";
  return (
    <Tilt radius={26}>
      <div
        style={{
          width: W,
          height: H,
          position: "relative",
          borderRadius: 26,
          background: "linear-gradient(170deg, #7d6a55 0%, #574634 45%, #3a2d21 100%)",
          boxShadow:
            "0 22px 44px rgb(0 0 0 / 0.55), inset 0 0 0 3px #241a12, inset 0 0 0 5px #b9965f, inset 0 0 0 8px #2b2017, inset 0 10px 24px rgb(255 255 255 / 0.12), inset 0 -14px 30px rgb(0 0 0 / 0.55)",
          color: "#2b1d10",
          fontFamily: font("franklin", "sans-serif"),
        }}
      >
        <div className="tcg-grain" />
        {/* Portrait ovale cerclé d'or. */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 44,
            width: 212,
            height: 236,
            borderRadius: "50%",
            padding: 6,
            boxSizing: "border-box",
            background: "linear-gradient(145deg, #fff3c4, #d9a441 35%, #6f4a12 62%, #f3d27a 86%)",
            boxShadow: "0 8px 18px rgb(0 0 0 / 0.6)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              overflow: "hidden",
              position: "relative",
              boxShadow: "inset 0 0 18px rgb(0 0 0 / 0.7)",
            }}
          >
            <PremiumArt card={card} round />
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                boxShadow: "inset 0 0 24px rgb(0 0 0 / 0.65)",
              }}
            />
          </div>
        </div>
        {legendary && (
          <svg
            width="170"
            height="46"
            viewBox="0 0 170 46"
            style={{ position: "absolute", top: 4, left: 65 }}
            aria-hidden
          >
            <path
              d="M85 4 L98 18 L120 8 L114 26 L160 14 L134 38 L85 30 L36 38 L10 14 L56 26 L50 8 L72 18 Z"
              fill="url(#tcg-g-gold)"
              stroke="#3a2708"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="85" cy="22" r="6" fill="#ff8a1e" stroke="#3a2708" strokeWidth="2" />
          </svg>
        )}
        {/* Cristal de mana (ou rond bleu façon Snap). */}
        {snapBadges ? (
          <div style={{ position: "absolute", left: 0, top: 0 }}>
            <Cost value={card.cost} />
          </div>
        ) : (
          <svg
            width="70"
            height="78"
            viewBox="0 0 70 78"
            style={{ position: "absolute", left: 2, top: 2 }}
            role="img"
            aria-label={`Coût ${card.cost}`}
          >
            <polygon
              points="35,3 64,22 58,62 35,75 12,62 6,22"
              fill="url(#tcg-g-mana)"
              stroke="#0b1b45"
              strokeWidth="3"
            />
            <polygon points="35,3 64,22 35,30 6,22" fill="rgb(255 255 255 / 0.35)" />
            <polygon points="6,22 35,30 12,62" fill="rgb(255 255 255 / 0.12)" />
            <polygon points="35,30 58,62 35,75" fill="rgb(0 0 0 / 0.22)" />
            <Num x={35} y={42} size={32} family={font("fantasy", "serif")}>
              {card.cost}
            </Num>
          </svg>
        )}
        {/* Ruban du nom, texte courbé. */}
        <svg
          width={W}
          height="74"
          viewBox="0 0 300 74"
          style={{ position: "absolute", left: 0, top: 226 }}
          aria-hidden={false}
          role="img"
          aria-label={card.title}
        >
          <path
            d="M14 30 L36 22 L36 52 L14 60 L26 44 Z"
            fill="#6e4b1f"
            stroke="#2b1a08"
            strokeWidth="2"
          />
          <path
            d="M286 30 L264 22 L264 52 L286 60 L274 44 Z"
            fill="#6e4b1f"
            stroke="#2b1a08"
            strokeWidth="2"
          />
          <path
            d="M30 26 Q150 2 270 26 L270 54 Q150 30 30 54 Z"
            fill="url(#tcg-g-ribbon)"
            stroke="#2b1a08"
            strokeWidth="2.5"
          />
          <path id="tcg-ribbon-arc" d="M40 46 Q150 22 260 46" fill="none" />
          <text
            fontFamily={font("fantasy", "serif")}
            fontSize={card.title.length > 18 ? 13 : 16}
            fill="#fff"
            stroke="#1c1006"
            strokeWidth="3.5"
            paintOrder="stroke"
            textAnchor="middle"
            style={{ fontWeight: 800 }}
          >
            <textPath href="#tcg-ribbon-arc" startOffset="50%">
              {card.title}
            </textPath>
          </text>
        </svg>
        {/* Gemme de rareté. */}
        <svg
          width="22"
          height="28"
          viewBox="0 0 22 28"
          style={{ position: "absolute", left: 139, top: 284 }}
          role="img"
          aria-label={RARITY_LABELS[card.rarity]}
        >
          <path d="M11 1 L21 11 L11 27 L1 11 Z" fill={gem} stroke="#1c1006" strokeWidth="2" />
          <path d="M11 1 L21 11 L11 11 Z" fill="rgb(255 255 255 / 0.5)" />
        </svg>
        {/* Texte de la carte. */}
        <div
          style={{
            position: "absolute",
            top: 312,
            left: 36,
            right: 36,
            height: 76,
            boxSizing: "border-box",
            borderRadius: "10px 10px 22px 22px",
            background: "radial-gradient(ellipse at 50% 30%, #f6ead0, #d6c095)",
            boxShadow:
              "inset 0 0 0 2px rgb(70 48 20 / 0.7), inset 0 3px 10px rgb(0 0 0 / 0.25), 0 2px 4px rgb(0 0 0 / 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "4px 10px",
            fontSize: 12.5,
            lineHeight: "15px",
            fontWeight: 600,
          }}
        >
          {card.effect}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "3px 14px",
            borderRadius: 6,
            background: "linear-gradient(#3b2c1e, #1f160e)",
            border: "1.5px solid #b9965f",
            color: "#f3e3bf",
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 700,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {card.tag}
        </div>
        {/* Puissance dans une goutte de sang (ou hexagone jaune façon Snap). */}
        {snapBadges ? (
          <div style={{ position: "absolute", right: 0, bottom: 2 }}>
            <Power value={card.power} />
          </div>
        ) : (
          <svg
            width="66"
            height="74"
            viewBox="0 0 66 74"
            style={{ position: "absolute", right: 0, bottom: 0 }}
            role="img"
            aria-label={`Puissance ${card.power}`}
          >
            <path
              d="M33 4 C46 22 60 34 60 48 C60 63 48 71 33 71 C18 71 6 63 6 48 C6 34 20 22 33 4 Z"
              fill="url(#tcg-g-blood)"
              stroke="#2a0503"
              strokeWidth="3"
            />
            <ellipse cx="24" cy="42" rx="6" ry="10" fill="rgb(255 255 255 / 0.3)" />
            <Num x={33} y={50} size={30} family={font("fantasy", "serif")}>
              {card.power}
            </Num>
          </svg>
        )}
        <Finish rarity={card.rarity} orbit={gem} holo={false} />
      </div>
    </Tilt>
  );
}

/* ───────────────────────── Pokémon : bord jaune, énergies ───────────────────────── */

const POKE_SYMBOL: Record<CardRarity, string> = {
  common: "●",
  uncommon: "◆",
  rare: "★",
  legendary: "★★",
};

function Energy({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.85) 0 14%, ${color} 50%, rgb(0 0 0 / 0.55) 110%)`,
        boxShadow: "0 0 0 1.5px #fff, 0 1px 2px rgb(0 0 0 / 0.5)",
        color: "#fff",
        textShadow: "0 0 2px #000",
        fontSize: size * 0.62,
        lineHeight: 1,
      }}
    >
      ✦
    </span>
  );
}

export function PokeCard({ card }: { card: CardData }) {
  const f = faction(card.tag);
  const secret = card.rarity === "legendary";
  return (
    <Tilt radius={16}>
      <div
        style={{
          width: W,
          height: H,
          boxSizing: "border-box",
          position: "relative",
          borderRadius: 16,
          padding: 9,
          background: secret
            ? "linear-gradient(135deg, #fff6c9, #d7a43c 25%, #7a5014 45%, #f2cf73 65%, #a26f1f 85%, #fff1b0)"
            : "linear-gradient(135deg, #fff08a, #f2c418 40%, #ffe66b 62%, #d9a90d)",
          boxShadow: "0 20px 40px rgb(0 0 0 / 0.5), inset 0 0 0 1px rgb(0 0 0 / 0.25)",
          fontFamily: font("poke", "sans-serif"),
          color: "#1b1b1b",
        }}
      >
        <div
          style={{
            height: "100%",
            boxSizing: "border-box",
            borderRadius: 8,
            padding: "7px 9px 6px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            position: "relative",
            overflow: "hidden",
            background: `repeating-linear-gradient(135deg, rgb(255 255 255 / 0.08) 0 6px, transparent 6px 14px), linear-gradient(165deg, ${f.light} 0%, ${f.base} 60%, ${f.dark} 120%)`,
            boxShadow: "inset 0 0 0 1.5px rgb(0 0 0 / 0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <span
              style={{
                fontSize: 8.5,
                fontStyle: "italic",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 8,
                background: "linear-gradient(#f7f7f7, #bdbdbd)",
                boxShadow: "0 0 0 1px rgb(0 0 0 / 0.35)",
              }}
            >
              DE BASE
            </span>
            <span
              style={{
                flex: 1,
                fontSize: card.title.length > 18 ? 13 : card.title.length > 12 ? 15.5 : 19,
                fontWeight: 900,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {card.title}
            </span>
            <span style={{ fontSize: 9, fontWeight: 900, color: "#c0121b" }}>PUI</span>
            <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 0.9, color: "#c0121b" }}>
              {card.power * 10}
            </span>
            <Energy color={f.dark} size={20} />
          </div>
          <div
            style={{
              height: 200,
              padding: 4,
              boxSizing: "border-box",
              background: secret
                ? "linear-gradient(135deg, #fff6c9, #c8962b, #fff1b0, #8a5c18)"
                : "linear-gradient(135deg, #ffffff, #9aa7b3 40%, #f3f6f8 60%, #6b7782)",
              boxShadow: "0 2px 4px rgb(0 0 0 / 0.45)",
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                position: "relative",
                overflow: "hidden",
                boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.4)",
              }}
            >
              <PremiumArt card={card} />
              {card.rarity !== "common" && (
                <div
                  className="tcg-holo"
                  style={{ borderRadius: 0, mixBlendMode: "overlay", opacity: 0.38 }}
                />
              )}
            </div>
          </div>
          <div
            style={{
              alignSelf: "center",
              marginTop: -4,
              fontSize: 8.5,
              fontStyle: "italic",
              fontWeight: 700,
              padding: "1px 12px",
              background: "linear-gradient(90deg, #a9a9a9, #f5f5f5 30%, #f5f5f5 70%, #a9a9a9)",
              clipPath: "polygon(4% 0, 96% 0, 100% 100%, 0 100%)",
            }}
          >
            Carte n° {card.serial ?? "—"} · Famille {card.tag}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span
              style={{
                flexShrink: 0,
                fontSize: 9,
                fontWeight: 900,
                fontStyle: "italic",
                color: "#fff",
                background: "#c0121b",
                padding: "2px 6px",
                borderRadius: 4,
                marginTop: 1,
              }}
            >
              Talent
            </span>
            <span style={{ fontSize: 12, lineHeight: "15px", fontWeight: 700 }}>{card.effect}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              paddingTop: 4,
              borderTop: "1px solid rgb(0 0 0 / 0.25)",
            }}
          >
            {Array.from({ length: Math.min(card.cost, 6) }, (_, i) => (
              <Energy key={i} color={f.dark} size={16} />
            ))}
            <span style={{ flex: 1, fontSize: 13, fontWeight: 900, paddingLeft: 6 }}>Attaque</span>
            <span style={{ fontSize: 18, fontWeight: 900 }}>{card.power * 10}</span>
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 8.5,
              fontWeight: 700,
              paddingTop: 3,
              borderTop: "1px solid rgb(0 0 0 / 0.25)",
            }}
          >
            <span>faiblesse —</span>
            <span>résistance —</span>
            <span>retraite ●</span>
          </div>
          {card.flavor && (
            <div
              style={{
                fontSize: 8.5,
                lineHeight: "10px",
                fontStyle: "italic",
                padding: "3px 6px",
                border: "1px solid rgb(0 0 0 / 0.3)",
                borderRadius: 3,
                background: "rgb(255 255 255 / 0.25)",
                maxHeight: 24,
                overflow: "hidden",
              }}
            >
              {card.flavor}
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 7.5,
              fontWeight: 700,
            }}
          >
            <span>Illus. {card.author ?? "Potopia"}</span>
            <span>
              {card.serial ?? ""}{" "}
              <span
                style={{
                  color: secret ? "#ffe27a" : "#111",
                  textShadow: secret ? "0 0 2px #000" : "none",
                }}
              >
                {POKE_SYMBOL[card.rarity]}
              </span>
            </span>
          </div>
        </div>
        {secret && <div className="tcg-holo" />}
        <Finish rarity={card.rarity} orbit="#fff2a8" holo={false} />
      </div>
    </Tilt>
  );
}

/* ───────────────────────── Magic : cadre de couleur, symbole d'édition ───────────────────────── */

const MAGIC_SET: Record<CardRarity, string> = {
  common: "#1a1a1a",
  uncommon: "url(#tcg-g-silver)",
  rare: "url(#tcg-g-gold)",
  legendary: "url(#tcg-g-mythic)",
};

function Plate({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 8px 0 10px",
        borderRadius: 14,
        background: "linear-gradient(#fbf6ea, #dccfb2)",
        boxShadow:
          "inset 0 -2px 0 rgb(0 0 0 / 0.2), inset 0 1px 0 #fff, 0 1px 3px rgb(0 0 0 / 0.6)",
        border: "1px solid #3b3122",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function MagicCard({
  card,
  snapBadges = false,
}: {
  card: CardData;
  /** Rond bleu et hexagone jaune façon Snap à la place des symboles de mana et du P/T. */
  snapBadges?: boolean;
}) {
  const f = faction(card.tag);
  return (
    <Tilt radius={15}>
      <div
        style={{
          width: W,
          height: H,
          boxSizing: "border-box",
          position: "relative",
          borderRadius: 15,
          padding: "11px 11px 20px",
          background: "#0d0d0d",
          boxShadow: "0 20px 40px rgb(0 0 0 / 0.55)",
          color: "#16110b",
        }}
      >
        <div
          style={{
            height: "100%",
            boxSizing: "border-box",
            borderRadius: "6px 6px 14px 14px",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 5,
            position: "relative",
            background: `linear-gradient(160deg, ${f.light} 0%, ${f.base} 45%, ${f.dark} 110%)`,
            boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.35), inset 0 0 0 2px rgb(0 0 0 / 0.4)",
          }}
        >
          <div className="tcg-grain" style={{ opacity: 0.25 }} />
          <Plate style={{ height: 28, position: "relative", paddingLeft: snapBadges ? 46 : 10 }}>
            <span
              style={{
                flex: 1,
                fontFamily: font("magic", "serif"),
                fontWeight: 700,
                fontSize: card.title.length > 18 ? 13 : 15,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {card.title}
            </span>
            {!snapBadges && (
              <span aria-label={`Coût ${card.cost}`} style={{ display: "flex", gap: 2 }}>
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 30%, #f3f0ea, #b8b2a8)",
                    boxShadow: "0 1px 1px rgb(0 0 0 / 0.6)",
                    fontSize: 11,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: font("magic", "serif"),
                  }}
                >
                  {Math.max(card.cost - 1, 0)}
                </span>
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 35% 30%, ${f.light}, ${f.base})`,
                    boxShadow: "0 1px 1px rgb(0 0 0 / 0.6)",
                  }}
                />
              </span>
            )}
          </Plate>
          <div
            style={{
              height: 176,
              position: "relative",
              margin: "0 4px",
              border: "2px solid #1a140c",
              boxShadow: "0 0 0 1px rgb(255 255 255 / 0.4), inset 0 0 10px rgb(0 0 0 / 0.5)",
              overflow: "hidden",
            }}
          >
            <PremiumArt card={card} />
          </div>
          <Plate style={{ height: 24, position: "relative" }}>
            <span
              style={{
                flex: 1,
                fontFamily: font("magic", "serif"),
                fontWeight: 700,
                fontSize: 12,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Créature — {card.tag}
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              role="img"
              aria-label={RARITY_LABELS[card.rarity]}
            >
              <path
                d="M9 1 L16 5 L14 13 L9 17 L4 13 L2 5 Z"
                fill={MAGIC_SET[card.rarity]}
                stroke="#000"
                strokeWidth="1.2"
              />
              <circle cx="9" cy="8.5" r="2.4" fill="rgb(0 0 0 / 0.55)" />
            </svg>
          </Plate>
          <div
            style={{
              flex: 1,
              margin: "0 4px",
              position: "relative",
              borderRadius: 3,
              padding: "7px 10px",
              background: "linear-gradient(#f6efe0, #e5d8bd)",
              boxShadow: "inset 0 0 0 1px rgb(60 45 25 / 0.5), inset 0 2px 6px rgb(0 0 0 / 0.15)",
              fontFamily: font("fantasy-text", "serif"),
              fontSize: 13.5,
              lineHeight: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 5,
              overflow: "hidden",
            }}
          >
            <div>{card.effect}</div>
            {card.flavor && (
              <div
                style={{
                  fontStyle: "italic",
                  fontSize: 12.5,
                  lineHeight: "15px",
                  borderTop: "1px solid rgb(60 45 25 / 0.3)",
                  paddingTop: 4,
                  color: "#3a2e20",
                }}
              >
                {card.flavor}
              </div>
            )}
          </div>
          {snapBadges ? (
            <div
              style={{
                position: "absolute",
                right: -6,
                bottom: -14,
                transform: "scale(0.85)",
                transformOrigin: "100% 100%",
              }}
            >
              <Power value={card.power} />
            </div>
          ) : (
            <Plate
              style={{
                position: "absolute",
                right: 12,
                bottom: -10,
                height: 26,
                padding: "0 12px",
                borderRadius: 8,
              }}
            >
              <span
                aria-label={`Puissance ${card.power}`}
                style={{ fontFamily: font("magic", "serif"), fontWeight: 800, fontSize: 16 }}
              >
                {card.power}
              </span>
            </Plate>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 3,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 7.5,
            color: "#d8d2c4",
            fontFamily: font("franklin", "sans-serif"),
            letterSpacing: 0.4,
          }}
        >
          <span>
            {card.serial ?? "—"} · {card.rarity[0]?.toUpperCase()} · POT · FR — Illus.{" "}
            {card.author ?? "Potopia"}
          </span>
          <span>™ & © Potopia</span>
        </div>
        {snapBadges && (
          <div
            style={{
              position: "absolute",
              left: -4,
              top: -4,
              transform: "scale(0.85)",
              transformOrigin: "0 0",
            }}
          >
            <Cost value={card.cost} />
          </div>
        )}
        <Finish rarity={card.rarity} orbit={f.light} />
      </div>
    </Tilt>
  );
}
