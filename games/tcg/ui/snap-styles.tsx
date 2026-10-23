import type { CSSProperties } from "react";
import { type CardData, font } from "./cards";
import { faction, PremiumArt } from "./premium";
import { GOLD, Ring, type SnapFinish } from "./snap";

/*
 * Dix styles Snap de plus : or massif, kawaii, pop art, glitch, aquarelle, croquis, cosmique,
 * sans bordure, vitrail et aux couleurs du thème du site. Chacun fournit son illustration, son
 * cadre et le style du nom ; la carte (snap.tsx) garde le reste : badges, effet au survol, finitions.
 */

export const EXTRA_STYLES = [
  "gold",
  "kawaii",
  "popart",
  "glitch",
  "watercolor",
  "sketch",
  "cosmic",
  "borderless",
  "stained",
  "theme",
  "goldspot",
  "cosmicframe",
  "watercolorframe",
] as const;
export type ExtraStyle = (typeof EXTRA_STYLES)[number];

export const isExtraStyle = (s: string): s is ExtraStyle =>
  (EXTRA_STYLES as readonly string[]).includes(s);

/** Styles qui gardent le cadre et le nom du Snap classique (seule l'illustration change). */
export const hasClassicChrome = (s: string) => s === "watercolorframe";

/** Styles sur fond clair (papier) : texte sombre en bas de carte. */
export const isPaperStyle = (s: string) => s === "watercolor" || s === "sketch";

const R = 22;
const fill: CSSProperties = { position: "absolute", inset: 0 };

/** Filtres SVG des styles (identifiants globaux, une fois par plateau). */
export function ExtraDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        {/* Postérisation : 4 niveaux par canal (pop art, vitrail). */}
        <filter id="tcg-posterize" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0 0.33 0.66 1" />
            <feFuncG type="discrete" tableValues="0 0.33 0.66 1" />
            <feFuncB type="discrete" tableValues="0 0.33 0.66 1" />
          </feComponentTransfer>
        </filter>
        {/* Croquis : contours détectés, traits sombres sur fond blanc. */}
        <filter id="tcg-sketch" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feConvolveMatrix
            order="3"
            kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"
            preserveAlpha="true"
          />
          <feComponentTransfer>
            <feFuncR type="linear" slope="-5" intercept="1" />
            <feFuncG type="linear" slope="-5" intercept="1" />
            <feFuncB type="linear" slope="-5" intercept="1" />
          </feComponentTransfer>
        </filter>
        {/* Aquarelle : bords qui ondulent comme de la peinture qui a bavé. */}
        <filter id="tcg-watercolor" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" />
        </filter>
        {/* Glitch : canal rouge seul, canaux vert et bleu seuls. */}
        <filter id="tcg-red" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        <filter id="tcg-cyan" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
        </filter>
      </defs>
    </svg>
  );
}

/** Ciel étoilé (style cosmique). */
const STARS =
  "radial-gradient(1px 1px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 72% 12%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 76%, #fff, transparent), radial-gradient(1px 1px at 88% 64%, #fff, transparent), radial-gradient(1px 1px at 22% 58%, #cfe, transparent), radial-gradient(1.5px 1.5px at 62% 40%, #fff, transparent), radial-gradient(1px 1px at 8% 88%, #fff, transparent), radial-gradient(1px 1px at 92% 90%, #fde, transparent), radial-gradient(1px 1px at 50% 8%, #fff, transparent), radial-gradient(1px 1px at 30% 30%, #fff, transparent)";

export function ExtraArt({ card, style }: { card: CardData; style: ExtraStyle }) {
  const f = faction(card.tag);
  switch (style) {
    case "gold":
      return (
        <div style={fill}>
          <div style={{ ...fill, filter: "grayscale(1) contrast(1.3) brightness(1.05)" }}>
            <PremiumArt card={card} />
          </div>
          <div aria-hidden style={{ ...fill, background: GOLD, mixBlendMode: "multiply" }} />
          <div
            aria-hidden
            style={{
              ...fill,
              background:
                "radial-gradient(circle at 30% 20%, rgb(255 246 200 / 0.55), transparent 55%)",
              mixBlendMode: "screen",
            }}
          />
        </div>
      );
    case "kawaii":
      return (
        <div style={fill}>
          <div style={{ ...fill, filter: "saturate(1.1) brightness(1.08) contrast(0.95)" }}>
            <PremiumArt card={card} />
          </div>
          <div
            aria-hidden
            style={{
              ...fill,
              background: "linear-gradient(160deg, #ffd1ec 0%, transparent 45%, #c9f3ff 100%)",
              mixBlendMode: "soft-light",
            }}
          />
          <div
            aria-hidden
            style={{
              ...fill,
              backgroundImage:
                "radial-gradient(circle, rgb(255 255 255 / 0.6) 0 2px, transparent 2.5px)",
              backgroundSize: "26px 26px",
              opacity: 0.35,
            }}
          />
        </div>
      );
    case "popart":
      return (
        <div style={{ ...fill, background: "#ffe600" }}>
          <div style={{ ...fill, filter: "url(#tcg-posterize) saturate(2.4) contrast(1.35)" }}>
            <PremiumArt card={card} />
          </div>
          <div
            aria-hidden
            style={{
              ...fill,
              backgroundImage: "radial-gradient(circle, #e8112d 0 2.4px, transparent 2.8px)",
              backgroundSize: "9px 9px",
              mixBlendMode: "multiply",
              opacity: 0.45,
            }}
          />
        </div>
      );
    case "glitch":
      return (
        <div style={{ ...fill, background: "#000", filter: "contrast(1.15) brightness(0.9)" }}>
          {/* Canal rouge décalé à gauche, vert et bleu à droite : additionnés, ils redonnent
              l'image, avec des franges colorées sur les contours. */}
          <div
            aria-hidden
            style={{ ...fill, filter: "url(#tcg-red)", transform: "translateX(-4px)" }}
          >
            <PremiumArt card={card} />
          </div>
          <div
            aria-hidden
            style={{
              ...fill,
              filter: "url(#tcg-cyan)",
              mixBlendMode: "screen",
              transform: "translateX(4px)",
            }}
          >
            <PremiumArt card={card} />
          </div>
          <div aria-hidden className="tcg-glitch-slice" style={fill}>
            <PremiumArt card={card} />
          </div>
          <div className="tcg-scan" />
        </div>
      );
    case "watercolor":
      return (
        <div style={{ ...fill, background: "#f6f0e4" }}>
          <div className="tcg-grain" style={{ opacity: 0.45 }} />
          <div
            style={{
              position: "absolute",
              inset: "18px 16px 70px",
              filter: "url(#tcg-watercolor) saturate(1.25) contrast(0.92) brightness(1.06)",
              WebkitMaskImage:
                "radial-gradient(ellipse 72% 70% at 50% 46%, #000 58%, transparent 82%)",
              maskImage: "radial-gradient(ellipse 72% 70% at 50% 46%, #000 58%, transparent 82%)",
            }}
          >
            <PremiumArt card={card} />
          </div>
          <div
            aria-hidden
            style={{
              ...fill,
              background: `radial-gradient(ellipse at 30% 25%, ${f.light}55, transparent 50%), radial-gradient(ellipse at 75% 70%, ${f.base}33, transparent 55%)`,
              mixBlendMode: "multiply",
            }}
          />
        </div>
      );
    case "sketch":
      return (
        <div style={{ ...fill, background: "#f8f6f0" }}>
          <div
            style={{
              position: "absolute",
              inset: "16px 14px 70px",
              filter: "url(#tcg-sketch) contrast(1.1)",
              mixBlendMode: "multiply",
              WebkitMaskImage:
                "radial-gradient(ellipse 75% 72% at 50% 45%, #000 62%, transparent 85%)",
              maskImage: "radial-gradient(ellipse 75% 72% at 50% 45%, #000 62%, transparent 85%)",
            }}
          >
            <PremiumArt card={card} />
          </div>
          <div
            aria-hidden
            style={{ ...fill, background: `${f.light}`, mixBlendMode: "multiply", opacity: 0.18 }}
          />
          <div
            aria-hidden
            style={{
              ...fill,
              backgroundImage:
                "repeating-linear-gradient(0deg, rgb(70 110 170 / 0.12) 0 1px, transparent 1px 22px)",
            }}
          />
        </div>
      );
    case "cosmic":
      return (
        <div
          style={{
            ...fill,
            background: `${STARS}, radial-gradient(ellipse at 20% 15%, #5b2a9e 0%, transparent 50%), radial-gradient(ellipse at 85% 80%, #0e6f7a 0%, transparent 55%), #070516`,
          }}
        >
          <div
            style={{
              ...fill,
              WebkitMaskImage:
                "radial-gradient(ellipse 62% 52% at 50% 42%, #000 40%, transparent 78%)",
              maskImage: "radial-gradient(ellipse 62% 52% at 50% 42%, #000 40%, transparent 78%)",
            }}
          >
            <PremiumArt card={card} />
          </div>
          <div
            aria-hidden
            style={{
              ...fill,
              background:
                "radial-gradient(ellipse at 50% 42%, transparent 35%, rgb(140 80 255 / 0.35) 70%)",
              mixBlendMode: "screen",
            }}
          />
        </div>
      );
    case "stained":
      return (
        <div style={fill}>
          <div style={{ ...fill, filter: "url(#tcg-posterize) saturate(1.7) brightness(1.12)" }}>
            <PremiumArt card={card} />
          </div>
          <div
            aria-hidden
            style={{
              ...fill,
              background:
                "radial-gradient(ellipse at 50% 20%, rgb(255 240 200 / 0.4), transparent 60%)",
              mixBlendMode: "screen",
            }}
          />
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 140"
            preserveAspectRatio="none"
            style={fill}
            aria-hidden
          >
            <g stroke="#14100c" strokeWidth="1.4" fill="none" strokeLinejoin="round">
              <polyline points="0,30 22,26 48,34 70,22 100,28" />
              <polyline points="0,64 30,58 52,70 78,60 100,68" />
              <polyline points="0,98 26,104 54,94 80,102 100,96" />
              <polyline points="22,26 30,58 26,104 24,140" />
              <polyline points="48,34 52,70 54,94 50,140" />
              <polyline points="70,22 78,60 80,102 76,140" />
              <polyline points="48,0 48,34" />
              <polyline points="30,58 52,70" />
            </g>
            <g stroke="rgb(255 255 255 / 0.35)" strokeWidth="0.4" fill="none">
              <polyline points="0,29.2 22,25.2 48,33.2 70,21.2 100,27.2" />
              <polyline points="0,63.2 30,57.2 52,69.2 78,59.2 100,67.2" />
            </g>
          </svg>
        </div>
      );
    case "theme":
      return (
        <div style={fill}>
          <PremiumArt card={card} />
          <div
            aria-hidden
            style={{
              ...fill,
              background:
                "linear-gradient(200deg, color-mix(in oklab, var(--accent, #7c8cff) 45%, transparent), transparent 55%)",
              mixBlendMode: "soft-light",
            }}
          />
        </div>
      );
    case "goldspot":
      // Or partout sauf au centre, où le sujet est le plus souvent : il garde ses couleurs.
      return (
        <div style={fill}>
          <PremiumArt card={card} />
          <div
            aria-hidden
            style={{
              ...fill,
              WebkitMaskImage:
                "radial-gradient(ellipse 34% 30% at 50% 44%, transparent 55%, #000 100%)",
              maskImage: "radial-gradient(ellipse 34% 30% at 50% 44%, transparent 55%, #000 100%)",
            }}
          >
            <div style={{ ...fill, filter: "grayscale(1) contrast(1.3) brightness(1.05)" }}>
              <PremiumArt card={card} />
            </div>
            <div style={{ ...fill, background: GOLD, mixBlendMode: "multiply" }} />
          </div>
        </div>
      );
    case "watercolorframe":
      return (
        <div style={{ ...fill, background: "#f6f0e4" }}>
          <div
            style={{
              ...fill,
              filter: "url(#tcg-watercolor) saturate(1.3) contrast(0.95) brightness(1.04)",
            }}
          >
            <PremiumArt card={card} />
          </div>
          <div className="tcg-grain" style={{ opacity: 0.35, mixBlendMode: "multiply" }} />
          <div
            aria-hidden
            style={{
              ...fill,
              background: `radial-gradient(ellipse at 25% 20%, ${f.light}44, transparent 50%)`,
              mixBlendMode: "multiply",
            }}
          />
        </div>
      );
    case "borderless":
    case "cosmicframe":
    default:
      return (
        <div style={fill}>
          <PremiumArt card={card} />
        </div>
      );
  }
}

/** Petits autocollants du style kawaii. */
function Stickers() {
  const star = "M10 1 L12.6 7 L19 7.6 L14.2 12 L15.6 18.4 L10 15 L4.4 18.4 L5.8 12 L1 7.6 L7.4 7 Z";
  const heart =
    "M10 17 C2 11 1 6 4.5 3.5 C7 1.8 9 3.5 10 5 C11 3.5 13 1.8 15.5 3.5 C19 6 18 11 10 17 Z";
  const items = [
    { d: star, x: 230, y: 92, s: 1.3, c: "#ffd34d", r: 12 },
    { d: heart, x: 22, y: 300, s: 1.2, c: "#ff7ab8", r: -14 },
    { d: star, x: 250, y: 318, s: 0.9, c: "#8ee6ff", r: -8 },
    { d: heart, x: 248, y: 150, s: 0.8, c: "#ff9fd0", r: 18 },
  ];
  return (
    <svg
      width="300"
      height="420"
      viewBox="0 0 300 420"
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      {items.map((it, i) => (
        <g key={i} transform={`translate(${it.x} ${it.y}) rotate(${it.r}) scale(${it.s})`}>
          <path d={it.d} fill="#fff" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
          <path d={it.d} fill={it.c} />
        </g>
      ))}
    </svg>
  );
}

export function ExtraFrame({
  style,
  finish,
  card,
}: {
  style: ExtraStyle;
  finish: SnapFinish;
  card: CardData;
}) {
  const f = faction(card.tag);
  const legendary = finish === "legendary";
  switch (style) {
    case "gold":
      return (
        <>
          <Ring background={GOLD} width={10} />
          <Ring
            background="linear-gradient(#3a2604 0 0)"
            width={1.5}
            style={{ inset: 10, borderRadius: R - 9 }}
          />
        </>
      );
    case "kawaii":
      return (
        <>
          <Ring
            background={
              legendary
                ? GOLD
                : "linear-gradient(155deg, #ffb3d9, #ffe1f1 30%, #b8f0ff 60%, #d9c4ff)"
            }
            width={11}
            style={{ borderRadius: 30 }}
          />
          <Ring
            background="linear-gradient(#fff 0 0)"
            width={3}
            style={{ inset: 11, borderRadius: 20 }}
          />
          <Stickers />
        </>
      );
    case "popart":
      return (
        <>
          <Ring background="linear-gradient(#111 0 0)" width={12} />
          <Ring
            background={legendary ? GOLD : "linear-gradient(#ffe600 0 0)"}
            width={7}
            style={{ inset: 2.5, borderRadius: R - 2 }}
          />
        </>
      );
    case "glitch":
      return (
        <>
          <Ring background="linear-gradient(#05050a 0 0)" width={7} />
          <Ring
            background="linear-gradient(#ff2bd6 0 0)"
            width={1.5}
            style={{ inset: 7, transform: "translate(-1.5px, 0)", borderRadius: R - 6 }}
          />
          <Ring
            background="linear-gradient(#2bf0ff 0 0)"
            width={1.5}
            style={{ inset: 7, transform: "translate(1.5px, 0)", borderRadius: R - 6 }}
          />
        </>
      );
    case "watercolor":
      return (
        <>
          <Ring
            background={legendary ? GOLD : `linear-gradient(160deg, ${f.light}, ${f.base})`}
            width={2}
            style={{ opacity: 0.7 }}
          />
          <Ring
            background="linear-gradient(rgb(60 40 20 / 0.25) 0 0)"
            width={1}
            style={{ inset: 6, borderRadius: R - 5 }}
          />
        </>
      );
    case "sketch":
      return (
        <svg
          width="300"
          height="420"
          viewBox="0 0 300 420"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          <rect
            x="7"
            y="8"
            width="286"
            height="404"
            rx="18"
            fill="none"
            stroke={legendary ? "#b8861f" : "#2a2a2a"}
            strokeWidth="2.2"
            transform="rotate(-0.4 150 210)"
          />
          <rect
            x="9"
            y="6"
            width="283"
            height="407"
            rx="20"
            fill="none"
            stroke={legendary ? "#d9a73a" : "#2a2a2a"}
            strokeWidth="1"
            opacity="0.6"
            transform="rotate(0.5 150 210)"
          />
        </svg>
      );
    case "cosmic":
      return (
        <>
          <Ring
            background={
              legendary ? GOLD : "linear-gradient(160deg, #b99cff, #3a1e78 45%, #0d0a24 100%)"
            }
            width={8}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 8,
              borderRadius: R - 7,
              boxShadow: "0 0 18px rgb(150 100 255 / 0.65), inset 0 0 18px rgb(150 100 255 / 0.45)",
            }}
          />
        </>
      );
    case "borderless":
      return (
        <Ring
          background={legendary ? GOLD : "linear-gradient(rgb(255 255 255 / 0.35) 0 0)"}
          width={legendary ? 3 : 1}
        />
      );
    case "stained":
      return (
        <>
          <Ring
            background="conic-gradient(from 20deg, #b5121b 0 12%, #1d4fb8 0 26%, #1e8a3c 0 41%, #d4a017 0 55%, #6d2aa8 0 70%, #b5121b 0 84%, #1d4fb8 0)"
            width={10}
          />
          <Ring background="linear-gradient(#14100c 0 0)" width={2.5} />
          <Ring
            background="linear-gradient(#14100c 0 0)"
            width={2.5}
            style={{ inset: 8, borderRadius: R - 7 }}
          />
          {legendary && (
            <Ring background={GOLD} width={2} style={{ inset: 3.5, borderRadius: R - 3 }} />
          )}
        </>
      );
    case "goldspot":
      return (
        <>
          <Ring background={GOLD} width={10} />
          <Ring
            background="linear-gradient(#3a2604 0 0)"
            width={1.5}
            style={{ inset: 10, borderRadius: R - 9 }}
          />
        </>
      );
    case "cosmicframe":
      // Bordure épaisse en nébuleuse étoilée, qui déborde de la carte en halo.
      return (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -14,
              borderRadius: R + 14,
              padding: 26,
              background: `${STARS}, radial-gradient(ellipse at 20% 20%, #8a4dff 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, #19b5c7 0%, transparent 55%), #0b0820`,
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
              filter: `drop-shadow(0 0 10px ${legendary ? "#ffd56a" : "#9b6bff"})`,
              opacity: 0.95,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -14,
              borderRadius: R + 14,
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 62%, rgb(7 5 22 / 0.9) 100%)",
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
              padding: 14,
              opacity: 0.6,
            }}
          />
          <Ring
            background={legendary ? GOLD : "linear-gradient(160deg, #d8c6ff, #6c3fd6)"}
            width={2}
            style={{ inset: 12, borderRadius: R - 10 }}
          />
        </>
      );
    case "watercolorframe":
      return null;
    case "theme":
      return (
        <>
          <Ring
            background="linear-gradient(160deg, var(--accent-hover, #a8b4ff), var(--accent, #7c8cff) 45%, color-mix(in oklab, var(--accent, #7c8cff) 35%, #000) 100%)"
            width={8}
          />
          <Ring
            background="linear-gradient(rgb(0 0 0 / 0.6) 0 0)"
            width={2}
            style={{ inset: 8, borderRadius: R - 7 }}
          />
        </>
      );
  }
}

export function extraName(
  style: ExtraStyle,
  finish: SnapFinish,
  len: number,
): { className?: string; css: CSSProperties } {
  const size = len > 16 ? 23 : 29;
  const legendary = finish === "legendary";
  const snap: CSSProperties = {
    fontFamily: font("snap", "Impact, sans-serif"),
    fontSize: size,
    letterSpacing: 0.5,
    filter: "drop-shadow(0 3px 0 #000) drop-shadow(0 0 10px rgb(0 0 0 / 0.8))",
  };
  switch (style) {
    case "gold":
    case "goldspot":
      return { className: "tcg-gold-text", css: snap };
    case "cosmicframe":
      return { className: legendary ? "tcg-gold-text" : "tcg-chrome-text", css: snap };
    case "watercolorframe":
      return {
        css: {
          ...snap,
          color: "#fff",
          filter: undefined,
          textShadow: "0 3px 0 #000, 0 0 16px rgb(0 0 0 / 0.9)",
        },
      };
    case "cosmic":
      return { className: legendary ? "tcg-gold-text" : "tcg-chrome-text", css: snap };
    case "kawaii":
      return {
        css: {
          fontFamily: font("round", "sans-serif"),
          fontWeight: 900,
          fontSize: size - 1,
          color: "#fff",
          WebkitTextStroke: `6px ${legendary ? "#c8901c" : "#ff6fae"}`,
          paintOrder: "stroke fill",
          textTransform: "none",
        },
      };
    case "popart":
      return {
        css: {
          fontFamily: font("comic", "Impact, sans-serif"),
          fontSize: size + 5,
          letterSpacing: 1,
          color: "#fff",
          WebkitTextStroke: "7px #111",
          paintOrder: "stroke fill",
          textShadow: `5px 5px 0 ${legendary ? "#d39b2a" : "#e8112d"}`,
        },
      };
    case "glitch":
      return {
        css: {
          fontFamily: font("grotesk", "sans-serif"),
          fontWeight: 700,
          fontSize: size - 4,
          letterSpacing: 3,
          color: "#fff",
          textShadow: "2px 0 #ff2bd6, -2px 0 #2bf0ff, 0 0 10px rgb(0 0 0 / 0.9)",
        },
      };
    case "watercolor":
      return {
        css: {
          fontFamily: font("hand", "cursive"),
          fontWeight: 700,
          fontSize: size + 9,
          color: "#3a2a1a",
          textTransform: "none",
        },
      };
    case "sketch":
      return {
        css: {
          fontFamily: font("hand", "cursive"),
          fontWeight: 700,
          fontSize: size + 9,
          color: "#1d1d1d",
          textTransform: "none",
        },
      };
    case "stained":
      return {
        className: "tcg-gold-text",
        css: {
          fontFamily: font("fantasy", "serif"),
          fontWeight: 800,
          fontSize: size - 4,
          letterSpacing: 1.5,
          filter: "drop-shadow(0 2px 0 #000) drop-shadow(0 0 8px rgb(0 0 0 / 0.9))",
        },
      };
    case "theme":
      return {
        css: {
          fontFamily: "var(--font-display, var(--font-snap)), Impact, sans-serif",
          fontWeight: 700,
          fontSize: size - 2,
          color: "#fff",
          textShadow:
            "0 0 14px color-mix(in oklab, var(--accent, #7c8cff) 70%, transparent), 0 3px 0 #000",
        },
      };
    case "borderless":
      return {
        className: legendary ? "tcg-gold-text" : undefined,
        css: {
          ...snap,
          fontSize: len > 14 ? 34 : 42,
          color: legendary ? undefined : "#fff",
          filter: "drop-shadow(0 3px 0 #000) drop-shadow(0 0 14px rgb(0 0 0 / 0.9))",
        },
      };
  }
}
