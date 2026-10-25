import { BRAND } from "@app/config/brand";
import type { CSSProperties, ReactNode } from "react";
import { type CardData, font } from "./cards";
import { faction, PremiumArt } from "./premium";
import { Cost, GOLD, PEARL, Power, Ring, SNAP_FINISH_LABELS, type SnapFinish } from "./snap";
import { Tilt } from "./Tilt";

/*
 * Deuxième vague de propositions, d'après les avis : des V2, V3, V4 des designs les mieux notés
 * (Snap, Arcanes, Taverne, Poké, Cosmique, Néon, raretés) et des essais pris ailleurs (duel,
 * tarot, Balatro). Même règle : la finition ne change que le look, jamais les stats.
 */

export const W = 300;
export const H = 420;
export const R = 22;
export const fill: CSSProperties = { position: "absolute", inset: 0 };

/** Carte de base : inclinaison, profondeur, ombre portée et reflet. */
export function Shell({
  radius = R,
  card,
  children,
  shadow = "0 24px 46px rgb(0 0 0 / 0.55)",
}: {
  radius?: number;
  card: CardData;
  children: ReactNode;
  shadow?: string;
}) {
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
          boxShadow: shadow,
          outline: "none",
        }}
      >
        {children}
        <div className="tcg-glare" style={{ borderRadius: radius }} />
      </div>
    </Tilt>
  );
}

/** Calque à une profondeur donnée (parallaxe quand la carte s'incline). */
export function Layer({
  z,
  style,
  className,
  children,
}: {
  z: number;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`tcg-layer ${className ?? ""}`}
      style={{ "--z": `${z}px`, position: "absolute", ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Illustration rognée aux coins de la carte. */
export function Art({
  card,
  radius = R,
  style,
}: {
  card: CardData;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{ ...fill, borderRadius: radius, overflow: "hidden", background: "#0b0d18", ...style }}
    >
      <PremiumArt card={card} />
    </div>
  );
}

/** Effet de la carte, qui remplace le nom au survol. */
function Reveal({
  card,
  accent,
  bottom = 16,
  z = 60,
}: {
  card: CardData;
  accent: string;
  bottom?: number;
  z?: number;
}) {
  return (
    <Layer
      z={z}
      className="tcg-reveal"
      style={{
        left: 14,
        right: 14,
        bottom,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgb(10 12 30 / 0.88)",
        border: `1px solid ${accent}`,
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.6)",
        color: "#eef0ff",
        fontFamily: font("franklin", "sans-serif"),
        fontSize: 13,
        lineHeight: "17px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: font("snap", "Impact, sans-serif"),
          fontSize: 15,
          textTransform: "uppercase",
          marginBottom: 4,
          color: accent,
        }}
      >
        {card.title}
      </div>
      {card.effect}
    </Layer>
  );
}

export const METAL: Record<SnapFinish, string> = {
  common:
    "linear-gradient(145deg, #eef1f6 0%, #9aa2b1 30%, #4a505c 60%, #c9ced8 80%, #2c3038 100%)",
  uncommon:
    "linear-gradient(145deg, #d9ffe9 0%, #49d390 30%, #0f5d39 60%, #8ff0c0 80%, #0b4029 100%)",
  rare: "linear-gradient(145deg, #efe9ff 0%, #9b80ff 30%, #35238a 60%, #c9b8ff 80%, #1f1458 100%)",
  legendary: GOLD,
  sr: PEARL,
  ssr: "conic-gradient(from 210deg, #ff6ab5, #ffd36a, #7dffb0, #6ad5ff, #b88bff, #ff6ab5)",
};
export const ACCENT: Record<SnapFinish, string> = {
  common: "#c9ced8",
  uncommon: "#6ff0b0",
  rare: "#b39cff",
  legendary: "#ffd56a",
  sr: "#ffc6e6",
  ssr: "#ffffff",
};

/* ═════════════════════ Snap V2 · Cadre sculpté ═════════════════════ */

/** Cadre épais en relief, plaque de nom gravée, badges sertis. */
export function SnapSculpted({
  card,
  finish = card.rarity,
  signed = false,
}: {
  card: CardData;
  finish?: SnapFinish;
  signed?: boolean;
}) {
  const accent = ACCENT[finish];
  const chromeName =
    finish === "ssr" ? "tcg-chrome-text" : finish === "legendary" ? "tcg-gold-text" : undefined;
  return (
    <Shell card={card}>
      <Art card={card} />
      {finish === "ssr" && (
        <div className="tcg-lenti" style={{ ...fill, borderRadius: R, overflow: "hidden" }}>
          <div
            style={{
              ...fill,
              filter: "saturate(1.8) hue-rotate(170deg) contrast(1.15) brightness(0.9)",
            }}
          >
            <PremiumArt card={card} />
          </div>
        </div>
      )}
      <div
        aria-hidden
        style={{
          ...fill,
          borderRadius: R,
          background:
            "linear-gradient(to top, rgb(6 7 18 / 0.9) 0%, rgb(6 7 18 / 0.35) 26%, transparent 45%)",
        }}
      />
      {(finish === "rare" || finish === "sr" || finish === "ssr") && <div className="tcg-holo" />}
      {finish === "sr" && <div className="tcg-etched" />}
      <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
        {finish === "ssr" ? (
          <div className="tcg-prism" style={{ "--prism-w": "13px" } as CSSProperties} />
        ) : (
          <Ring background={METAL[finish]} width={13} />
        )}
        {/* Biseau : lumière en haut à gauche, ombre en bas à droite. */}
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
            inset: 13,
            borderRadius: R - 11,
            boxShadow:
              "0 0 0 2px rgb(0 0 0 / 0.75), 0 0 0 3px rgb(255 255 255 / 0.25), inset 0 0 22px rgb(0 0 0 / 0.55)",
          }}
        />
        {(finish === "legendary" || finish === "ssr") && <div className="tcg-shine" />}
      </Layer>
      {/* Badges sertis dans un anneau de métal. */}
      <Layer z={56} style={{ left: -4, top: -4 }}>
        <div
          style={{
            padding: 4,
            borderRadius: "50%",
            background: METAL[finish],
            boxShadow: "0 4px 10px rgb(0 0 0 / 0.6)",
          }}
        >
          <div style={{ margin: -4 }}>
            <Cost value={card.cost} />
          </div>
        </div>
      </Layer>
      <Layer z={56} style={{ right: -4, top: -3 }}>
        <div
          style={{
            clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
            padding: 4,
            background: METAL[finish],
          }}
        >
          <div style={{ margin: -4 }}>
            <Power value={card.power} />
          </div>
        </div>
      </Layer>
      {/* Plaque du nom. */}
      <Layer
        z={46}
        className="tcg-hide-on-reveal"
        style={{ left: 22, right: 22, bottom: 26, pointerEvents: "none" }}
      >
        <div
          style={{
            clipPath: "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)",
            padding: 3,
            background: METAL[finish],
          }}
        >
          <div
            style={{
              clipPath: "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)",
              background: "linear-gradient(#1a1d2e, #07080f)",
              padding: "7px 18px 6px",
              textAlign: "center",
            }}
          >
            <div
              className={chromeName}
              style={{
                fontFamily: font("snap", "Impact, sans-serif"),
                fontSize: card.title.length > 16 ? 19 : 24,
                lineHeight: 1,
                textTransform: "uppercase",
                color: chromeName ? undefined : "#fff",
                letterSpacing: 0.5,
              }}
            >
              {card.title}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 5,
            textAlign: "center",
            fontFamily: font("franklin", "sans-serif"),
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 2.2,
            color: accent,
            textTransform: "uppercase",
            textShadow: "0 1px 2px #000",
          }}
        >
          {card.tag} · {SNAP_FINISH_LABELS[finish]}
        </div>
      </Layer>
      {signed && (
        <Layer
          z={30}
          style={{ right: 24, bottom: 92, transform: "rotate(-8deg)", pointerEvents: "none" }}
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
            {card.author ?? BRAND.name}
          </span>
        </Layer>
      )}
      <Reveal card={card} accent={accent} />
    </Shell>
  );
}

/* ═════════════════════ Snap V3 · Infini ═════════════════════ */

export const FLOW: Record<SnapFinish, string> = {
  common: "#9aa7ff, #ffffff, #9aa7ff",
  uncommon: "#2bf0a0, #c6fff0, #00c2ff, #2bf0a0",
  rare: "#9b6bff, #ff6ad5, #6ad5ff, #9b6bff",
  legendary: "#ffd56a, #fff6d0, #c8901c, #ffd56a",
  sr: "#ffd6ec, #ffffff, #b8ecff, #ffd6ec",
  ssr: "#ff6ab5, #ffd36a, #7dffb0, #6ad5ff, #b88bff, #ff6ab5",
};

/** Un liseré d'énergie qui court sans fin autour de la carte, et la carte qui « respire ». */
export function SnapInfinity({
  card,
  finish = card.rarity,
}: {
  card: CardData;
  finish?: SnapFinish;
}) {
  const accent = ACCENT[finish];
  return (
    <Shell card={card} shadow={`0 24px 46px rgb(0 0 0 / 0.55), 0 0 26px ${accent}55`}>
      <Art card={card} />
      <div
        aria-hidden
        style={{
          ...fill,
          borderRadius: R,
          background:
            "linear-gradient(to top, rgb(6 7 18 / 0.92) 0%, rgb(6 7 18 / 0.45) 24%, transparent 44%)",
        }}
      />
      {finish !== "common" && finish !== "uncommon" && <div className="tcg-holo" />}
      <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
        <Ring background="linear-gradient(#07080f 0 0)" width={9} />
        <div className="tcg-flow" style={{ "--flow": FLOW[finish] } as CSSProperties} />
        <div
          className="tcg-breathe"
          style={{
            position: "absolute",
            inset: 9,
            borderRadius: R - 8,
            boxShadow: `inset 0 0 26px ${accent}88`,
          }}
        />
        {finish === "legendary" && <div className="tcg-shine" />}
      </Layer>
      <Layer z={56} style={{ left: 2, top: 2 }}>
        <Cost value={card.cost} />
      </Layer>
      <Layer z={56} style={{ right: 1, top: 2 }}>
        <Power value={card.power} />
      </Layer>
      <Layer
        z={46}
        className="tcg-hide-on-reveal"
        style={{ left: 14, right: 14, bottom: 24, textAlign: "center", pointerEvents: "none" }}
      >
        <div
          className={finish === "legendary" ? "tcg-gold-text" : undefined}
          style={{
            fontFamily: font("snap", "Impact, sans-serif"),
            fontSize: card.title.length > 16 ? 23 : 30,
            lineHeight: 1,
            textTransform: "uppercase",
            color: finish === "legendary" ? undefined : "#fff",
            textShadow: finish === "legendary" ? undefined : `0 3px 0 #000, 0 0 18px ${accent}`,
            filter: finish === "legendary" ? "drop-shadow(0 3px 0 #000)" : undefined,
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            marginTop: 7,
            fontFamily: font("franklin", "sans-serif"),
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2.4,
            color: accent,
            textTransform: "uppercase",
          }}
        >
          {card.tag} · {SNAP_FINISH_LABELS[finish]}
        </div>
      </Layer>
      <Reveal card={card} accent={accent} />
    </Shell>
  );
}

/* ═════════════════════ Snap V4 · Profondeur ═════════════════════ */

/**
 * Trois plans : un fond flou et assombri loin derrière, le cadre au milieu, et le centre de l'image
 * (là où est le sujet) net, devant le cadre. En inclinant la carte, le sujet se détache du fond.
 */
export function SnapDepth({ card, finish = card.rarity }: { card: CardData; finish?: SnapFinish }) {
  const accent = ACCENT[finish];
  return (
    <Shell card={card}>
      <div style={{ ...fill, borderRadius: R, overflow: "hidden", background: "#05060c" }}>
        <Layer z={-40} style={{ inset: -30 }}>
          <div
            style={{
              ...fill,
              filter: "blur(7px) brightness(0.6) saturate(1.2)",
              transform: "scale(1.15)",
            }}
          >
            <PremiumArt card={card} />
          </div>
        </Layer>
      </div>
      <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
        <Ring background={METAL[finish]} width={9} />
        <Ring
          background="linear-gradient(rgb(0 0 0 / 0.7) 0 0)"
          width={2}
          style={{ inset: 9, borderRadius: R - 8 }}
        />
      </Layer>
      <Layer
        z={34}
        style={{
          ...fill,
          pointerEvents: "none",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 44% at 50% 42%, #000 58%, transparent 100%)",
          maskImage: "radial-gradient(ellipse 50% 44% at 50% 42%, #000 58%, transparent 100%)",
          filter: "drop-shadow(0 10px 14px rgb(0 0 0 / 0.65))",
        }}
      >
        <div style={{ ...fill, transform: "scale(1.04)" }}>
          <PremiumArt card={card} />
        </div>
      </Layer>
      {(finish === "rare" || finish === "legendary") && <div className="tcg-holo" />}
      <Layer z={70} style={{ left: 2, top: 2 }}>
        <Cost value={card.cost} />
      </Layer>
      <Layer z={70} style={{ right: 1, top: 2 }}>
        <Power value={card.power} />
      </Layer>
      <Layer
        z={60}
        className="tcg-hide-on-reveal"
        style={{ left: 14, right: 14, bottom: 22, textAlign: "center", pointerEvents: "none" }}
      >
        <div
          className={finish === "legendary" ? "tcg-gold-text" : undefined}
          style={{
            fontFamily: font("snap", "Impact, sans-serif"),
            fontSize: 30,
            lineHeight: 1,
            textTransform: "uppercase",
            color: finish === "legendary" ? undefined : "#fff",
            textShadow:
              finish === "legendary" ? undefined : "0 3px 0 #000, 0 0 16px rgb(0 0 0 / 0.9)",
            filter: finish === "legendary" ? "drop-shadow(0 3px 0 #000)" : undefined,
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            marginTop: 7,
            fontFamily: font("franklin", "sans-serif"),
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2.4,
            color: accent,
            textTransform: "uppercase",
          }}
        >
          {card.tag} · {SNAP_FINISH_LABELS[finish]}
        </div>
      </Layer>
      <Reveal card={card} accent={accent} z={80} />
    </Shell>
  );
}

/* ═════════════════════ Arcanes V2 · Plein cadre ═════════════════════ */

export const SET_FILL: Record<SnapFinish, string> = {
  common: "#1a1a1a",
  uncommon: "linear-gradient(135deg, #fff, #8d99a4)",
  rare: "linear-gradient(135deg, #fff3b8, #c08a22)",
  legendary: "linear-gradient(135deg, #ffd6a0, #d4361b)",
  sr: PEARL,
  ssr: METAL.ssr,
};

/** L'illustration plein cadre de Snap, avec les barres et le texte des Arcanes en verre fumé. */
export function ArcanesFull({
  card,
  finish = card.rarity,
}: {
  card: CardData;
  finish?: SnapFinish;
}) {
  const f = faction(card.tag);
  const glass: CSSProperties = {
    background: "rgb(12 10 8 / 0.62)",
    backdropFilter: "blur(5px)",
    border: `1px solid ${f.light}88`,
    borderRadius: 10,
    color: "#f4ecdc",
  };
  return (
    <Shell card={card} radius={16}>
      <Art card={card} radius={16} />
      {(finish === "rare" || finish === "legendary") && <div className="tcg-holo" />}
      <Layer z={10} style={{ ...fill, borderRadius: 16, pointerEvents: "none" }}>
        <div
          style={{
            ...fill,
            borderRadius: 16,
            boxShadow: `inset 0 0 0 9px #0d0d0d, inset 0 0 0 10.5px ${f.light}, inset 0 0 0 12px #0d0d0d`,
          }}
        />
        {finish === "legendary" && <div className="tcg-shine" />}
      </Layer>
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
          ...glass,
        }}
      >
        <span
          style={{
            fontFamily: font("magic", "serif"),
            fontWeight: 800,
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.title}
        </span>
      </Layer>
      <Layer z={56} style={{ left: 2, top: 2 }}>
        <Cost value={card.cost} />
      </Layer>
      <Layer
        z={30}
        style={{
          left: 20,
          right: 20,
          top: 236,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 10px",
          ...glass,
        }}
      >
        <span style={{ fontFamily: font("magic", "serif"), fontWeight: 700, fontSize: 12.5 }}>
          Créature — {card.tag}
        </span>
        <span
          aria-label={SNAP_FINISH_LABELS[finish]}
          style={{
            width: 16,
            height: 16,
            clipPath: "polygon(50% 0, 100% 30%, 82% 100%, 18% 100%, 0 30%)",
            background: SET_FILL[finish],
          }}
        />
      </Layer>
      <Layer
        z={30}
        style={{
          left: 20,
          right: 20,
          top: 270,
          bottom: 46,
          padding: "8px 12px 8px 12px",
          fontFamily: font("fantasy-text", "serif"),
          fontSize: 13.5,
          lineHeight: "16px",
          overflow: "hidden",
          ...glass,
        }}
      >
        <div>{card.effect}</div>
        {card.flavor && (
          <div style={{ fontStyle: "italic", fontSize: 12.5, marginTop: 6, opacity: 0.85 }}>
            {card.flavor}
          </div>
        )}
      </Layer>
      <Layer
        z={56}
        style={{ right: 4, bottom: 4, transform: "scale(0.8)", transformOrigin: "100% 100%" }}
      >
        <Power value={card.power} />
      </Layer>
      <Layer
        z={20}
        style={{
          left: 22,
          bottom: 18,
          fontFamily: font("franklin", "sans-serif"),
          fontSize: 8.5,
          letterSpacing: 0.6,
          color: "#d8d2c4",
        }}
      >
        {card.serial ?? "—"} · {SNAP_FINISH_LABELS[finish]} · Idée de {card.author ?? "?"}
      </Layer>
    </Shell>
  );
}

/* ═════════════════════ Taverne V2 · Arche ═════════════════════ */

export const GEM: Record<SnapFinish, string> = {
  common: "#e9ecef",
  uncommon: "#3d8bff",
  rare: "#a155ff",
  legendary: "#ff8a1e",
  sr: "#ff9fd8",
  ssr: "#7dffb0",
};

/** Portrait en arche, pierre sculptée, torches qui vacillent, badges Snap. */
export function TaverneArch({
  card,
  finish = card.rarity,
}: {
  card: CardData;
  finish?: SnapFinish;
}) {
  return (
    <Shell card={card} radius={20}>
      <div
        style={{
          ...fill,
          borderRadius: 20,
          background: "linear-gradient(170deg, #6d5a46, #3b2e22 55%, #241b13)",
          boxShadow:
            "inset 0 0 0 3px #1c140d, inset 0 0 0 5px #c8a066, inset 0 0 0 8px #1c140d, inset 0 -18px 30px rgb(0 0 0 / 0.5)",
        }}
      />
      <div className="tcg-grain" style={{ borderRadius: 20 }} />
      <div
        className="tcg-torch"
        style={{
          position: "absolute",
          left: -10,
          top: 30,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgb(255 170 60 / 0.55), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        className="tcg-torch"
        style={{
          position: "absolute",
          right: -10,
          top: 30,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgb(255 170 60 / 0.55), transparent 70%)",
          pointerEvents: "none",
          animationDelay: "0.7s",
        }}
      />
      {/* Arche dorée. */}
      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          top: 22,
          height: 250,
          padding: 6,
          borderRadius: "120px 120px 14px 14px",
          background: "linear-gradient(145deg, #fff3c4, #d9a441 35%, #6f4a12 62%, #f3d27a 86%)",
          boxShadow: "0 8px 18px rgb(0 0 0 / 0.6)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "114px 114px 10px 10px",
            overflow: "hidden",
            boxShadow: "inset 0 0 20px rgb(0 0 0 / 0.7)",
          }}
        >
          <PremiumArt card={card} />
          {(finish === "rare" || finish === "legendary") && <div className="tcg-holo" />}
        </div>
      </div>
      {finish === "legendary" && (
        <svg
          width="150"
          height="40"
          viewBox="0 0 170 46"
          style={{ position: "absolute", top: 6, left: 75 }}
          aria-hidden
        >
          <path
            d="M85 4 L98 18 L120 8 L114 26 L160 14 L134 38 L85 30 L36 38 L10 14 L56 26 L50 8 L72 18 Z"
            fill="url(#tcg-g-gold)"
            stroke="#3a2708"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {/* Bandeau du nom. */}
      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          top: 258,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(#e0bf82, #9c7238)",
          clipPath:
            "polygon(0 15%, 6% 0, 94% 0, 100% 15%, 96% 50%, 100% 85%, 94% 100%, 6% 100%, 0 85%, 4% 50%)",
          boxShadow: "0 3px 6px rgb(0 0 0 / 0.5)",
        }}
      >
        <span
          style={{
            fontFamily: font("fantasy", "serif"),
            fontWeight: 800,
            fontSize: 16,
            color: "#fff",
            WebkitTextStroke: "3px #2a1806",
            paintOrder: "stroke fill",
          }}
        >
          {card.title}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          top: 296,
          width: 20,
          height: 20,
          transform: "rotate(45deg)",
          background: GEM[finish],
          border: "2px solid #1c1006",
          boxShadow: `0 0 10px ${GEM[finish]}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 34,
          right: 34,
          top: 322,
          height: 62,
          borderRadius: "10px 10px 20px 20px",
          background: "radial-gradient(ellipse at 50% 30%, #f6ead0, #d6c095)",
          boxShadow: "inset 0 0 0 2px rgb(70 48 20 / 0.7), 0 2px 4px rgb(0 0 0 / 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "4px 12px",
          fontFamily: font("franklin", "sans-serif"),
          fontSize: 12,
          lineHeight: "15px",
          fontWeight: 600,
          color: "#2b1d10",
        }}
      >
        {card.effect}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "2px 12px",
          borderRadius: 6,
          background: "#1f160e",
          border: "1.5px solid #c8a066",
          color: "#f3e3bf",
          fontSize: 9.5,
          letterSpacing: 2,
          fontWeight: 700,
          textTransform: "uppercase",
          fontFamily: font("franklin", "sans-serif"),
        }}
      >
        {card.tag}
      </div>
      <Layer z={40} style={{ left: -2, top: -2 }}>
        <Cost value={card.cost} />
      </Layer>
      <Layer z={40} style={{ right: -2, bottom: 0 }}>
        <Power value={card.power} />
      </Layer>
      {finish === "legendary" && <div className="tcg-shine" style={{ borderRadius: 20 }} />}
    </Shell>
  );
}

/* ═════════════════════ Poké V2 · Potomon ═════════════════════ */

/** L'idée des PV et des énergies, dans un style à nous : bord blanc brillant, bandeau en biais. */
export function Potomon({ card, finish = card.rarity }: { card: CardData; finish?: SnapFinish }) {
  const f = faction(card.tag);
  return (
    <Shell card={card} radius={18}>
      <div
        style={{
          ...fill,
          borderRadius: 18,
          background: "linear-gradient(145deg, #ffffff, #e6e9ef 50%, #ffffff)",
          boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.15)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 8,
          borderRadius: 12,
          overflow: "hidden",
          background: `radial-gradient(circle at 20% 15%, ${f.light}, ${f.base} 55%, ${f.dark})`,
        }}
      >
        <div
          aria-hidden
          style={{
            ...fill,
            backgroundImage:
              "radial-gradient(circle, rgb(255 255 255 / 0.18) 0 3px, transparent 3.5px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -20,
            right: -20,
            top: 10,
            height: 40,
            transform: "rotate(-4deg)",
            background: "rgb(255 255 255 / 0.92)",
            boxShadow: "0 3px 8px rgb(0 0 0 / 0.25)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 16,
            right: 80,
            fontFamily: font("poke", "sans-serif"),
            fontWeight: 900,
            fontSize: card.title.length > 14 ? 16 : 20,
            color: "#1b1b1b",
            transform: "rotate(-4deg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            position: "absolute",
            right: 10,
            top: 8,
            width: 62,
            height: 62,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #fff, #ffe066 40%, #f4a100)",
            boxShadow: "0 3px 8px rgb(0 0 0 / 0.35), inset 0 0 0 3px #fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font("poke", "sans-serif"),
            color: "#7a3b00",
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 900 }}>PV</span>
          <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{card.power * 10}</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: 76,
            height: 176,
            padding: 6,
            background: "#fff",
            borderRadius: 14,
            transform: "rotate(1.5deg)",
            boxShadow: "0 6px 14px rgb(0 0 0 / 0.35)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: 9,
              overflow: "hidden",
            }}
          >
            <PremiumArt card={card} />
            {finish !== "common" && (
              <div
                className="tcg-holo"
                style={{ borderRadius: 0, mixBlendMode: "overlay", opacity: 0.4 }}
              />
            )}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            top: 262,
            padding: "6px 10px",
            borderRadius: 10,
            background: "rgb(255 255 255 / 0.9)",
            fontFamily: font("poke", "sans-serif"),
            fontSize: 11.5,
            lineHeight: "14px",
            fontWeight: 700,
            color: "#1b1b1b",
          }}
        >
          <span
            style={{
              display: "inline-block",
              marginRight: 6,
              padding: "1px 6px",
              borderRadius: 4,
              background: f.dark,
              color: "#fff",
              fontSize: 9,
              fontWeight: 900,
            }}
          >
            TALENT
          </span>
          {card.effect}
        </div>
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 30,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {Array.from({ length: Math.min(card.cost, 6) }, (_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: 18,
                height: 18,
                clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                background: `linear-gradient(${f.light}, ${f.dark})`,
                boxShadow: "inset 0 0 0 2px #fff",
              }}
            />
          ))}
          <span
            style={{
              marginLeft: "auto",
              fontFamily: font("poke", "sans-serif"),
              fontSize: 10,
              fontWeight: 900,
              color: "#fff",
              textShadow: "0 1px 2px #000",
            }}
          >
            coût {card.cost}
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 10,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: font("poke", "sans-serif"),
            fontSize: 8.5,
            fontWeight: 700,
            color: "#fff",
            textShadow: "0 1px 2px #000",
          }}
        >
          <span>Illus. {card.author ?? "?"}</span>
          <span>
            {card.serial ?? ""} · {SNAP_FINISH_LABELS[finish]}
          </span>
        </div>
      </div>
      {finish === "legendary" && <div className="tcg-shine" style={{ borderRadius: 18 }} />}
    </Shell>
  );
}

/* ═════════════════════ Cosmique V3 · Aurore ═════════════════════ */

/** L'image reste intacte ; une aurore et des étoiles dansent derrière et autour de la carte. */
export function CosmicAurora({
  card,
  finish = card.rarity,
}: {
  card: CardData;
  finish?: SnapFinish;
}) {
  const accent = ACCENT[finish];
  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden
        className="tcg-aurora"
        style={{ position: "absolute", inset: -18, borderRadius: 50, pointerEvents: "none" }}
      />
      <div
        aria-hidden
        className="tcg-stars"
        style={{ position: "absolute", inset: -22, pointerEvents: "none" }}
      />
      <Shell card={card} shadow="0 24px 46px rgb(0 0 0 / 0.6), 0 0 40px rgb(140 90 255 / 0.55)">
        <Art card={card} />
        <div
          aria-hidden
          style={{
            ...fill,
            borderRadius: R,
            background:
              "linear-gradient(to top, rgb(6 5 22 / 0.92) 0%, rgb(6 5 22 / 0.4) 24%, transparent 44%)",
          }}
        />
        {finish !== "common" && <div className="tcg-holo" />}
        <Layer z={10} style={{ ...fill, borderRadius: R, pointerEvents: "none" }}>
          <Ring
            background={
              finish === "legendary"
                ? GOLD
                : "linear-gradient(160deg, #e5d8ff, #7a4dff 40%, #1d6f86 100%)"
            }
            width={6}
          />
          <div
            style={{
              position: "absolute",
              inset: 6,
              borderRadius: R - 5,
              boxShadow: "0 0 14px rgb(160 120 255 / 0.8), inset 0 0 16px rgb(120 200 255 / 0.45)",
            }}
          />
        </Layer>
        <Layer z={56} style={{ left: 2, top: 2 }}>
          <Cost value={card.cost} />
        </Layer>
        <Layer z={56} style={{ right: 1, top: 2 }}>
          <Power value={card.power} />
        </Layer>
        <Layer
          z={46}
          className="tcg-hide-on-reveal"
          style={{ left: 14, right: 14, bottom: 24, textAlign: "center", pointerEvents: "none" }}
        >
          <div
            className={finish === "legendary" ? "tcg-gold-text" : "tcg-chrome-text"}
            style={{
              fontFamily: font("snap", "Impact, sans-serif"),
              fontSize: 30,
              lineHeight: 1,
              textTransform: "uppercase",
              filter: "drop-shadow(0 3px 0 #000) drop-shadow(0 0 12px rgb(140 90 255 / 0.8))",
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              marginTop: 7,
              fontFamily: font("franklin", "sans-serif"),
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2.4,
              color: accent,
              textTransform: "uppercase",
            }}
          >
            {card.tag} · {SNAP_FINISH_LABELS[finish]}
          </div>
        </Layer>
        <Reveal card={card} accent={accent} />
      </Shell>
    </div>
  );
}

/* ═════════════════════ Néon V2 · Enseigne ═════════════════════ */

/** Comme une enseigne lumineuse : tube de néon en cadre, nom qui grésille, mur de briques. */
export function NeonSign({ card, finish = card.rarity }: { card: CardData; finish?: SnapFinish }) {
  const tube = finish === "legendary" ? "#ffd56a" : finish === "rare" ? "#ff5cf0" : "#46f0ff";
  return (
    <Shell card={card} shadow={`0 24px 46px rgb(0 0 0 / 0.6), 0 0 30px ${tube}55`}>
      <div
        style={{
          ...fill,
          borderRadius: R,
          background: "#140a0c",
          backgroundImage:
            "linear-gradient(rgb(0 0 0 / 0.5) 2px, transparent 2px), linear-gradient(90deg, rgb(0 0 0 / 0.5) 2px, transparent 2px)",
          backgroundSize: "40px 20px, 40px 40px",
        }}
      />
      <div style={{ position: "absolute", inset: 16, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ ...fill, filter: "saturate(1.3) contrast(1.1) brightness(0.85)" }}>
          <PremiumArt card={card} />
        </div>
        <div className="tcg-scan" />
        <div
          aria-hidden
          style={{
            ...fill,
            background: "linear-gradient(to top, rgb(10 4 8 / 0.9), transparent 45%)",
          }}
        />
      </div>
      <Layer
        z={14}
        style={{
          position: "absolute",
          inset: 10,
          borderRadius: 18,
          border: `3px solid ${tube}`,
          boxShadow: `0 0 8px ${tube}, 0 0 20px ${tube}, inset 0 0 10px ${tube}`,
          pointerEvents: "none",
        }}
      />
      <Layer z={56} style={{ left: 2, top: 2 }}>
        <div style={{ filter: `drop-shadow(0 0 8px ${tube})` }}>
          <Cost value={card.cost} />
        </div>
      </Layer>
      <Layer z={56} style={{ right: 1, top: 2 }}>
        <div style={{ filter: `drop-shadow(0 0 8px ${tube})` }}>
          <Power value={card.power} />
        </div>
      </Layer>
      <Layer
        z={46}
        className="tcg-hide-on-reveal"
        style={{ left: 14, right: 14, bottom: 30, textAlign: "center", pointerEvents: "none" }}
      >
        <div
          className="tcg-flicker"
          style={{
            fontFamily: font("hand", "cursive"),
            fontWeight: 700,
            fontSize: 40,
            lineHeight: 1,
            color: "#fff",
            textShadow: `0 0 4px #fff, 0 0 10px ${tube}, 0 0 22px ${tube}, 0 0 40px ${tube}`,
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: font("grotesk", "sans-serif"),
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 3,
            color: tube,
            textTransform: "uppercase",
            textShadow: `0 0 6px ${tube}`,
          }}
        >
          {card.tag} · {SNAP_FINISH_LABELS[finish]}
        </div>
      </Layer>
      <Reveal card={card} accent={tube} />
    </Shell>
  );
}

/* ═════════════════════ Essai · Duel ═════════════════════ */

/** Cadre de carte de duel : nom en haut, étoiles de niveau, encadré de type, ATK en bas. */
export function DuelCard({ card, finish = card.rarity }: { card: CardData; finish?: SnapFinish }) {
  const f = faction(card.tag);
  const foil = finish === "rare" || finish === "legendary";
  return (
    <Shell card={card} radius={8}>
      <div
        style={{
          ...fill,
          borderRadius: 8,
          padding: 12,
          background: "linear-gradient(160deg, #d98a3d, #b86a24 50%, #8a4a14)",
          boxShadow: "inset 0 0 0 2px #3a1e08",
        }}
      >
        <div className="tcg-grain" style={{ borderRadius: 8, opacity: 0.3 }} />
        <div
          style={{
            position: "relative",
            height: 30,
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            background: "linear-gradient(#f6e7c8, #d8c39a)",
            boxShadow: "inset 0 0 0 1.5px #3a1e08",
          }}
        >
          <span
            style={{
              flex: 1,
              fontFamily: font("magic", "serif"),
              fontWeight: 800,
              fontSize: 17,
              color: foil ? "#8a5a10" : "#1a0f06",
              textShadow: foil ? "0 1px 0 #fff6d8" : undefined,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {card.title}
          </span>
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 30%, ${f.light}, ${f.dark})`,
              border: "1.5px solid #fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: font("fantasy", "serif"),
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {card.tag.charAt(0).toUpperCase()}
          </span>
        </div>
        <div
          aria-label={`Coût ${card.cost}`}
          style={{
            position: "relative",
            height: 20,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 2,
            paddingRight: 4,
          }}
        >
          {Array.from({ length: Math.min(card.cost, 8) }, (_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #ffe9a8, #d1431f)",
                border: "1px solid #3a1e08",
                color: "#ffe9a8",
                fontSize: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ★
            </span>
          ))}
        </div>
        <div
          style={{
            position: "relative",
            height: 210,
            margin: "2px 8px",
            border: "3px solid #3a1e08",
            boxShadow: "0 0 0 2px #e8c88a",
            overflow: "hidden",
          }}
        >
          <PremiumArt card={card} />
          {foil && <div className="tcg-holo" style={{ borderRadius: 0 }} />}
        </div>
        <div
          style={{
            position: "relative",
            marginTop: 8,
            height: 92,
            padding: "5px 8px",
            background: "linear-gradient(#f6ecd8, #e3d2b0)",
            boxShadow: "inset 0 0 0 1.5px #3a1e08",
            fontFamily: font("fantasy-text", "serif"),
            fontSize: 12,
            lineHeight: "14px",
            color: "#1a0f06",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontFamily: font("magic", "serif"), fontWeight: 800, fontSize: 11.5 }}>
            [ {card.tag} / Effet ]
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>{card.effect}</div>
          <div
            style={{
              borderTop: "1px solid #1a0f06",
              paddingTop: 2,
              textAlign: "right",
              fontFamily: font("magic", "serif"),
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            PUI/{card.power * 300}
          </div>
        </div>
        <div
          style={{
            position: "relative",
            marginTop: 3,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 7.5,
            color: "#2a1404",
            fontFamily: font("franklin", "sans-serif"),
            fontWeight: 700,
          }}
        >
          <span>POT-FR{card.serial ? ` ${card.serial}` : ""}</span>
          <span>
            {SNAP_FINISH_LABELS[finish]} · Idée de {card.author ?? "?"}
          </span>
        </div>
      </div>
      {finish === "legendary" && <div className="tcg-shine" style={{ borderRadius: 8 }} />}
    </Shell>
  );
}

/* ═════════════════════ Essai · Tarot ═════════════════════ */

const ROMAN = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
];

/** Lame de tarot : fond ivoire, double filet noir et or, fenêtre en ogive, chiffre romain. */
export function TarotCard({ card, finish = card.rarity }: { card: CardData; finish?: SnapFinish }) {
  const n = Number(card.serial?.split("/")[0] ?? "0");
  const gilded = finish === "legendary" || finish === "rare";
  const line = gilded ? "#b8861f" : "#1a1a1a";
  return (
    <Shell card={card} radius={14}>
      <div
        style={{
          ...fill,
          borderRadius: 14,
          background: "linear-gradient(#f7f1e3, #ece2c9)",
          boxShadow: `inset 0 0 0 8px #f7f1e3, inset 0 0 0 10px ${line}, inset 0 0 0 13px #f7f1e3, inset 0 0 0 14px ${line}`,
        }}
      />
      <div className="tcg-grain" style={{ borderRadius: 14, opacity: 0.25 }} />
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font("fantasy", "serif"),
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: 3,
          color: line,
        }}
      >
        {ROMAN[n] ?? n}
      </div>
      <div
        style={{
          position: "absolute",
          left: 30,
          right: 30,
          top: 50,
          height: 270,
          borderRadius: "130px 130px 6px 6px",
          padding: 3,
          background: line,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "127px 127px 4px 4px",
            overflow: "hidden",
          }}
        >
          <div style={{ ...fill, filter: "sepia(0.35) contrast(1.05)" }}>
            <PremiumArt card={card} />
          </div>
          {gilded && (
            <div
              className="tcg-holo"
              style={{ borderRadius: 0, mixBlendMode: "overlay", opacity: 0.35 }}
            />
          )}
        </div>
      </div>
      <svg
        width="240"
        height="20"
        viewBox="0 0 240 20"
        style={{ position: "absolute", left: 30, top: 326 }}
        aria-hidden
      >
        <line x1="0" y1="10" x2="96" y2="10" stroke={line} strokeWidth="1" />
        <circle cx="120" cy="10" r="6" fill="none" stroke={line} strokeWidth="1.2" />
        <circle cx="120" cy="10" r="2" fill={line} />
        <line x1="144" y1="10" x2="240" y2="10" stroke={line} strokeWidth="1" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          top: 350,
          textAlign: "center",
          fontFamily: font("fantasy", "serif"),
          fontWeight: 800,
          fontSize: card.title.length > 16 ? 15 : 19,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: gilded ? "#8a5a10" : "#1a1a1a",
        }}
      >
        {card.title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          top: 378,
          textAlign: "center",
          fontFamily: font("fantasy-text", "serif"),
          fontStyle: "italic",
          fontSize: 12,
          color: "#4a4030",
        }}
      >
        {card.tag} · {SNAP_FINISH_LABELS[finish]}
      </div>
      {/* Coût et puissance gravés en médaillons. */}
      {[
        { v: card.cost, left: 18, label: "Coût" },
        { v: card.power, left: 248, label: "Puissance" },
      ].map((m) => (
        <div
          key={m.label}
          aria-label={`${m.label} ${m.v}`}
          style={{
            position: "absolute",
            left: m.left,
            top: 16,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#f7f1e3",
            border: `2px solid ${line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font("fantasy", "serif"),
            fontWeight: 800,
            fontSize: 15,
            color: line,
          }}
        >
          {m.v}
        </div>
      ))}
      <Reveal card={card} accent={line} bottom={14} />
      {finish === "legendary" && <div className="tcg-shine" style={{ borderRadius: 14 }} />}
    </Shell>
  );
}

/* ═════════════════════ Essai · Balatro ═════════════════════ */

/** Carte qui se balance doucement, bord blanc épais, jetons bleu (coût) et rouge (puissance). */
export function BalatroCard({
  card,
  finish = card.rarity,
}: {
  card: CardData;
  finish?: SnapFinish;
}) {
  const chip = (bg: string, v: number, label: string) => (
    <div
      aria-label={`${label} ${v}`}
      style={{
        minWidth: 52,
        padding: "6px 10px",
        borderRadius: 10,
        background: bg,
        boxShadow: "inset 0 -4px 0 rgb(0 0 0 / 0.3), 0 3px 0 rgb(0 0 0 / 0.45)",
        color: "#fff",
        fontFamily: font("pixel", "monospace"),
        fontSize: 16,
        textAlign: "center",
      }}
    >
      {v}
    </div>
  );
  return (
    <div className="tcg-sway">
      <Shell
        card={card}
        radius={16}
        shadow="0 10px 0 rgb(0 0 0 / 0.35), 0 24px 40px rgb(0 0 0 / 0.5)"
      >
        <div
          style={{
            ...fill,
            borderRadius: 16,
            background: "#f4f1ea",
            boxShadow: "inset 0 0 0 3px #2b2b3a",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 12,
            borderRadius: 10,
            overflow: "hidden",
            background: "#1e2a3a",
            boxShadow: "inset 0 0 0 3px #2b2b3a",
          }}
        >
          <div style={{ ...fill, filter: "url(#tcg-pixelate) saturate(1.4) contrast(1.1)" }}>
            <PremiumArt card={card} />
          </div>
          <div className="tcg-scan" />
          <div aria-hidden style={{ ...fill, boxShadow: "inset 0 0 40px rgb(0 0 0 / 0.6)" }} />
          {finish !== "common" && <div className="tcg-holo" />}
        </div>
        <div
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            top: 22,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {chip("#2f7bf0", card.cost, "Coût")}
          {chip("#e83a3a", card.power, "Puissance")}
        </div>
        <div
          className="tcg-hide-on-reveal"
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            bottom: 24,
            padding: "8px 6px",
            borderRadius: 10,
            background: "rgb(30 42 58 / 0.92)",
            boxShadow: "inset 0 0 0 2px #f4f1ea",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: font("pixel", "monospace"),
              fontSize: card.title.length > 14 ? 10 : 13,
              color: "#fff",
              lineHeight: "18px",
              textShadow: "2px 2px 0 #000",
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: font("pixel-text", "monospace"),
              fontSize: 16,
              color: ACCENT[finish],
            }}
          >
            {card.tag} · {SNAP_FINISH_LABELS[finish]}
          </div>
        </div>
        <Reveal card={card} accent="#e83a3a" bottom={20} />
      </Shell>
    </div>
  );
}
