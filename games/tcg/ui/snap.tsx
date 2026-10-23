import type { CSSProperties, ReactNode } from "react";
import { type CardData, font } from "./cards";
import { faction, PremiumArt } from "./premium";
import {
  ExtraArt,
  ExtraDefs,
  ExtraFrame,
  type ExtraStyle,
  extraName,
  hasClassicChrome,
  isExtraStyle,
  isPaperStyle,
} from "./snap-styles";
import { Tilt } from "./Tilt";

/*
 * Variantes « Snap » : illustration plein cadre, coût dans un rond bleu, puissance dans un hexagone
 * jaune, effet révélé au survol. Cinq styles ici (classique, encre, néon, pixel, prisme), dix de plus
 * dans snap-styles.tsx, et une échelle de finitions jusqu'aux raretés Secrète (SR) et Super secrète
 * (SSR).
 * La finition ne change que le look, jamais les stats.
 */

const W = 300;
const H = 420;
const R = 22;

export type SnapStyle = "classic" | "ink" | "neon" | "pixel" | "prism" | ExtraStyle;
export type SnapFinish = "common" | "uncommon" | "rare" | "legendary" | "sr" | "ssr";

export const SNAP_FINISH_LABELS: Record<SnapFinish, string> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  legendary: "Légendaire",
  sr: "Secrète (SR)",
  ssr: "Super secrète (SSR)",
};

/** Finition d'une carte d'après sa rareté (SR et SSR ne sont attribuées qu'à la main). */
export const finishOf = (card: CardData): SnapFinish => card.rarity;

/** Dégradés et filtres SVG des cartes Snap (identifiants globaux, une fois par plateau). */
export function SnapDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <radialGradient id="tcg-g-cost" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e6f6ff" />
          <stop offset="0.35" stopColor="#58b4ff" />
          <stop offset="0.75" stopColor="#1557d6" />
          <stop offset="1" stopColor="#0a2b7a" />
        </radialGradient>
        <linearGradient id="tcg-g-hex" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbd1" />
          <stop offset="0.35" stopColor="#ffd93d" />
          <stop offset="0.75" stopColor="#f4a100" />
          <stop offset="1" stopColor="#b86a00" />
        </linearGradient>
        {/* Mosaïque (variante pixel) : un pixel sur 8 est échantillonné puis étalé. */}
        <filter id="tcg-pixelate" x="0" y="0" width="1" height="1">
          <feFlood x="3" y="3" height="2" width="2" />
          <feComposite width="8" height="8" />
          <feTile result="grid" />
          <feComposite in="SourceGraphic" in2="grid" operator="in" />
          <feMorphology operator="dilate" radius="4" />
        </filter>
      </defs>
      <ExtraDefs />
    </svg>
  );
}

function Num({
  x,
  y,
  size,
  stroke,
  children,
}: {
  x: number;
  y: number;
  size: number;
  stroke: string;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontFamily={font("snap", "Impact, sans-serif")}
      fill="#fff"
      stroke={stroke}
      strokeWidth={size / 6}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}

/** Coût : rond bleu brillant. */
export function Cost({ value }: { value: number }) {
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`Coût ${value}`}>
      <circle cx="34" cy="35" r="29" fill="rgb(0 0 0 / 0.45)" />
      <circle cx="34" cy="33" r="28" fill="url(#tcg-g-cost)" stroke="#fff" strokeWidth="3.5" />
      <ellipse
        cx="25"
        cy="22"
        rx="12"
        ry="7"
        fill="rgb(255 255 255 / 0.45)"
        transform="rotate(-25 25 22)"
      />
      <Num x={34} y={35} size={34} stroke="#08245f">
        {value}
      </Num>
    </svg>
  );
}

/** Puissance : hexagone jaune brillant. */
export function Power({ value }: { value: number }) {
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" role="img" aria-label={`Puissance ${value}`}>
      <polygon
        points="35,6 61,20 61,50 35,64 9,50 9,20"
        fill="rgb(0 0 0 / 0.45)"
        transform="translate(0 2)"
      />
      <polygon
        points="35,5 60,19 60,49 35,63 10,49 10,19"
        fill="url(#tcg-g-hex)"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <polygon points="35,5 60,19 35,27 10,19" fill="rgb(255 255 255 / 0.35)" />
      <Num x={35} y={35} size={32} stroke="#6b3300">
        {value}
      </Num>
    </svg>
  );
}

/** Anneau de cadre : n'importe quel fond (dégradé, or…) découpé en bordure. */
export function Ring({
  background,
  width = 8,
  style,
}: {
  background: string;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: R,
        padding: width,
        background,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

export const GOLD =
  "linear-gradient(155deg, #fff7d1 0%, #f2c84b 18%, #9c6a12 36%, #ffe9a3 52%, #c38a24 70%, #fff3c0 86%, #8a5a10 100%)";
const PEARL =
  "linear-gradient(155deg, #ffffff 0%, #ffd6ec 20%, #d7b8ff 40%, #b8ecff 60%, #fff4d6 80%, #ffffff 100%)";
const FINISH_RING: Record<SnapFinish, string> = {
  common: "linear-gradient(160deg, #d9dde5 0%, #7a8190 40%, #353a44 100%)",
  uncommon: "linear-gradient(160deg, #c8f8de 0%, #34c47f 40%, #0d5232 100%)",
  rare: "linear-gradient(160deg, #e6ddff 0%, #8f72ff 40%, #2f1f7a 100%)",
  legendary: GOLD,
  sr: PEARL,
  ssr: GOLD,
};
const FINISH_ACCENT: Record<SnapFinish, string> = {
  common: "#b9c0cc",
  uncommon: "#5fe0a0",
  rare: "#a993ff",
  legendary: "#ffd56a",
  sr: "#ffc6e6",
  ssr: "#ffffff",
};

/** Illustration selon le style : photo, encre, néon ou mosaïque de pixels. */
function StyledArt({ card, style }: { card: CardData; style: SnapStyle }) {
  if (isExtraStyle(style)) return <ExtraArt card={card} style={style} />;
  const f = faction(card.tag);
  if (style === "ink") {
    return (
      <div style={{ position: "absolute", inset: 0, background: "#f3ecd9" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: "grayscale(1) contrast(1.9) brightness(1.12)",
          }}
        >
          <PremiumArt card={card} />
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: f.base,
            mixBlendMode: "multiply",
            opacity: 0.55,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgb(0 0 0 / 0.55) 0 1.1px, transparent 1.6px)",
            backgroundSize: "5px 5px",
            mixBlendMode: "multiply",
            opacity: 0.35,
          }}
        />
      </div>
    );
  }
  if (style === "pixel") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: "url(#tcg-pixelate) saturate(1.35) contrast(1.15)",
        }}
      >
        <PremiumArt card={card} />
      </div>
    );
  }
  if (style === "neon") {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: "saturate(1.35) contrast(1.1) brightness(0.78)",
          }}
        >
          <PremiumArt card={card} />
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(200deg, ${f.base}55, transparent 45%, #ff2bd655 100%)`,
            mixBlendMode: "screen",
          }}
        />
        <div className="tcg-scan" />
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <PremiumArt card={card} />
    </div>
  );
}

/** SR : de combien l'image monte au-dessus de la carte, et jusqu'où la partie qui déborde descend. */
const POP = { over: 22, reach: 64 };

/**
 * SR : l'image remplit la carte ; le haut de la même image, aligné au pixel près, est redessiné
 * devant le bord supérieur du cadre et au-delà, avec un fondu sur les côtés : le sujet semble
 * sortir de la carte. Sans détourage, ça marche quand le sujet est en haut au centre ; avec une
 * image détourée, le contour serait parfait.
 */
function BreakoutArt({ card, style }: { card: CardData; style: SnapStyle }) {
  const box: CSSProperties = { position: "absolute", left: 0, right: 0, top: -POP.over, bottom: 0 };
  return (
    <>
      <div style={{ position: "absolute", inset: 0, borderRadius: R, overflow: "hidden" }}>
        <div style={box}>
          <StyledArt card={card} style={style} />
        </div>
      </div>
      <div
        aria-hidden
        className="tcg-layer"
        style={
          {
            ...box,
            "--z": "30px",
            pointerEvents: "none",
            WebkitMaskImage:
              "radial-gradient(ellipse 56% 38% at 50% 16%, #000 48%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 56% 38% at 50% 16%, #000 48%, transparent 100%)",
            filter: "drop-shadow(0 6px 8px rgb(0 0 0 / 0.55))",
          } as CSSProperties
        }
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: `inset(0 0 calc(100% - ${POP.over + POP.reach}px) 0)`,
          }}
        >
          <StyledArt card={card} style={style} />
        </div>
      </div>
    </>
  );
}

/**
 * SSR lenticulaire : comme les cartes à image changeante, l'illustration bascule vers sa version
 * néon (ou dorée, pour une carte déjà néon) quand on penche la carte vers la droite.
 */
function LenticularArt({ card, style }: { card: CardData; style: SnapStyle }) {
  const alt: SnapStyle = style === "neon" ? "goldspot" : "neon";
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: R, overflow: "hidden" }}>
      <StyledArt card={card} style={style} />
      <div className="tcg-lenti" style={{ position: "absolute", inset: 0 }}>
        <StyledArt card={card} style={alt} />
      </div>
      <div className="tcg-lenti-lines" />
    </div>
  );
}

/** Cadre selon le style et la finition. */
function Frame({ style, finish, card }: { style: SnapStyle; finish: SnapFinish; card: CardData }) {
  const f = faction(card.tag);
  if (finish === "ssr" || style === "prism") {
    return (
      <>
        <div className="tcg-prism" style={{ "--prism-w": "8px" } as CSSProperties} />
        <Ring
          background="linear-gradient(#000 0 0)"
          width={1.5}
          style={{ inset: 8, borderRadius: R - 7, opacity: 0.6 }}
        />
      </>
    );
  }
  if (finish === "sr") {
    return (
      <>
        <Ring background={PEARL} width={10} />
        <Ring
          background="linear-gradient(rgb(0 0 0 / 0.55) 0 0)"
          width={1.5}
          style={{ inset: 10, borderRadius: R - 9 }}
        />
      </>
    );
  }
  if (isExtraStyle(style) && !hasClassicChrome(style)) {
    return <ExtraFrame style={style} finish={finish} card={card} />;
  }
  if (style === "ink") {
    return (
      <>
        <Ring background={finish === "legendary" ? GOLD : "linear-gradient(#111 0 0)"} width={8} />
        <Ring
          background="linear-gradient(#f3ecd9 0 0)"
          width={2}
          style={{ inset: 8, borderRadius: R - 7 }}
        />
      </>
    );
  }
  if (style === "neon") {
    const glow = finish === "legendary" ? "#ffd56a" : f.light;
    return (
      <>
        <Ring background="linear-gradient(#07070f 0 0)" width={7} />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 7,
            borderRadius: R - 6,
            border: `2px solid ${glow}`,
            boxShadow: `0 0 10px ${glow}, 0 0 22px ${glow}aa, inset 0 0 12px ${glow}88`,
            pointerEvents: "none",
          }}
        />
      </>
    );
  }
  if (style === "pixel") {
    const c = FINISH_ACCENT[finish];
    return (
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 4,
          boxShadow: `inset 0 0 0 4px #0b0c1a, inset 0 0 0 8px ${c}, inset 0 0 0 12px #0b0c1a`,
          pointerEvents: "none",
        }}
      />
    );
  }
  return (
    <>
      <Ring background={FINISH_RING[finish]} width={8} />
      <Ring
        background="linear-gradient(rgb(255 255 255 / 0.6) 0 0)"
        width={1.5}
        style={{ opacity: 0.8 }}
      />
      <Ring
        background="linear-gradient(rgb(0 0 0 / 0.7) 0 0)"
        width={2}
        style={{ inset: 8, borderRadius: R - 7 }}
      />
    </>
  );
}

function nameStyle(
  style: SnapStyle,
  finish: SnapFinish,
  len: number,
): { className?: string; css: CSSProperties } {
  if (isExtraStyle(style) && !hasClassicChrome(style)) return extraName(style, finish, len);
  const size = len > 16 ? 23 : 29;
  if (style === "pixel") {
    return {
      css: {
        fontFamily: font("pixel", "monospace"),
        fontSize: len > 14 ? 11 : 14,
        lineHeight: "20px",
        color: "#fff",
        textShadow: "3px 3px 0 #000",
      },
    };
  }
  if (style === "ink") {
    return {
      css: {
        fontFamily: font("comic", "Impact, sans-serif"),
        fontSize: size + 4,
        letterSpacing: 1,
        color: "#fff",
        WebkitTextStroke: "2px #111",
        textShadow: "4px 4px 0 #111",
      },
    };
  }
  if (style === "neon") {
    const c = finish === "legendary" ? "#ffd56a" : "#ff5cf0";
    return {
      css: {
        fontFamily: font("grotesk", "sans-serif"),
        fontWeight: 700,
        fontSize: size - 3,
        letterSpacing: 3,
        color: "#fff",
        textShadow: `0 0 6px ${c}, 0 0 14px ${c}, 0 0 28px ${c}`,
      },
    };
  }
  const base: CSSProperties = {
    fontFamily: font("snap", "Impact, sans-serif"),
    fontSize: size,
    letterSpacing: 0.5,
    filter: "drop-shadow(0 3px 0 #000) drop-shadow(0 0 12px rgb(0 0 0 / 0.8))",
  };
  if (finish === "legendary") return { className: "tcg-gold-text", css: base };
  if (finish === "ssr" || style === "prism") return { className: "tcg-chrome-text", css: base };
  return {
    css: {
      ...base,
      color: "#fff",
      filter: undefined,
      textShadow: "0 3px 0 #000, 0 0 16px rgb(0 0 0 / 0.9)",
    },
  };
}

const FINISH_SYMBOL: Record<SnapFinish, string> = {
  common: "●",
  uncommon: "◆",
  rare: "★",
  legendary: "★★",
  sr: "SR",
  ssr: "SSR",
};

export function SnapCard({
  card,
  style = "classic",
  finish = finishOf(card),
  edition = false,
}: {
  card: CardData;
  style?: SnapStyle;
  finish?: SnapFinish;
  /** Bandeau du bas : numéro dans la série, symbole de rareté, auteur de l'idée. */
  edition?: boolean;
}) {
  const name = nameStyle(style, finish, card.title.length);
  const accent = FINISH_ACCENT[finish];
  const radius = style === "pixel" ? 4 : style === "kawaii" ? 30 : R;
  const paper = isPaperStyle(style);
  return (
    <Tilt radius={radius}>
      <div
        className="tcg-depth"
        tabIndex={0}
        aria-label={`${card.title}, coût ${card.cost}, puissance ${card.power}. ${card.effect}`}
        style={{
          width: W,
          height: H,
          position: "relative",
          borderRadius: radius,
          boxShadow: "0 24px 46px rgb(0 0 0 / 0.55)",
          outline: "none",
        }}
      >
        {/* Illustration (ou éclats pour la SSR), rognée aux coins de la carte. */}
        {finish === "ssr" ? (
          <LenticularArt card={card} style={style} />
        ) : finish === "sr" ? (
          <BreakoutArt card={card} style={style} />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              overflow: "hidden",
              background: "#0b0d18",
            }}
          >
            <StyledArt card={card} style={style} />
          </div>
        )}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            pointerEvents: "none",
            background: paper
              ? "linear-gradient(to top, rgb(246 240 228 / 0.96) 0%, rgb(246 240 228 / 0.6) 18%, transparent 34%)"
              : "linear-gradient(to top, rgb(6 7 18 / 0.92) 0%, rgb(6 7 18 / 0.55) 22%, transparent 42%)",
          }}
        />
        {(finish === "rare" || finish === "sr" || finish === "ssr") && <div className="tcg-holo" />}
        {finish === "sr" && <div className="tcg-etched" />}
        <div
          className="tcg-layer"
          style={
            {
              "--z": "10px",
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              pointerEvents: "none",
            } as CSSProperties
          }
        >
          <Frame style={style} finish={finish} card={card} />
          {(finish === "legendary" || finish === "ssr") && <div className="tcg-shine" />}
        </div>
        <div
          className="tcg-layer"
          style={{ "--z": "56px", position: "absolute", left: 2, top: 2 } as CSSProperties}
        >
          <Cost value={card.cost} />
        </div>
        <div
          className="tcg-layer"
          style={{ "--z": "56px", position: "absolute", right: 1, top: 2 } as CSSProperties}
        >
          <Power value={card.power} />
        </div>
        <div
          className="tcg-layer tcg-hide-on-reveal"
          style={
            {
              "--z": "48px",
              position: "absolute",
              left: 14,
              right: 14,
              bottom: edition ? 34 : 22,
              textAlign: "center",
              pointerEvents: "none",
            } as CSSProperties
          }
        >
          {style !== "borderless" && (
            <div
              className={name.className}
              style={{ lineHeight: 1.02, textTransform: "uppercase", ...name.css }}
            >
              {card.title}
            </div>
          )}
          <div
            style={{
              marginTop: 7,
              fontFamily: font("franklin", "sans-serif"),
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2.4,
              color: paper ? "#5a4632" : accent,
              textTransform: "uppercase",
              textShadow: paper ? "none" : "0 1px 2px #000",
            }}
          >
            {card.tag} · {SNAP_FINISH_LABELS[finish]}
          </div>
        </div>
        {style === "borderless" && (
          <div
            className="tcg-layer tcg-hide-on-reveal"
            style={
              {
                "--z": "48px",
                position: "absolute",
                left: 6,
                top: 80,
                bottom: 52,
                display: "flex",
                alignItems: "flex-end",
                pointerEvents: "none",
              } as CSSProperties
            }
          >
            <div
              className={name.className}
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                lineHeight: 1,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                ...name.css,
              }}
            >
              {card.title}
            </div>
          </div>
        )}
        <div
          className="tcg-layer tcg-reveal"
          style={
            {
              "--z": "60px",
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 16,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgb(10 12 30 / 0.86)",
              border: `1px solid ${accent}`,
              boxShadow: `0 8px 24px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(0 0 0 / 0.5)`,
              color: "#eef0ff",
              fontFamily: font("franklin", "sans-serif"),
              fontSize: 13,
              lineHeight: "17px",
              textAlign: "center",
            } as CSSProperties
          }
        >
          <div
            style={{
              fontFamily: font("snap", "Impact, sans-serif"),
              fontSize: 15,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 4,
              color: accent,
            }}
          >
            {card.title}
          </div>
          {card.effect}
        </div>
        {edition && (
          <div
            className="tcg-layer tcg-hide-on-reveal"
            style={
              {
                "--z": "40px",
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                paddingTop: 5,
                borderTop: `1px solid ${accent}66`,
                fontFamily: font("franklin", "sans-serif"),
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: paper ? "#5a4632" : "rgb(255 255 255 / 0.85)",
                pointerEvents: "none",
              } as CSSProperties
            }
          >
            <span>
              {card.serial ?? "—"} <span style={{ color: accent }}>{FINISH_SYMBOL[finish]}</span>
            </span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Idée de {card.author ?? "?"}
            </span>
          </div>
        )}
        <div className="tcg-glare" style={{ borderRadius: radius }} />
      </div>
    </Tilt>
  );
}
