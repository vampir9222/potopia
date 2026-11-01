import { useId } from "react";

/**
 * Dos des cartes (variante A : métal et or), le même pour toutes les cartes.
 * SVG vectoriel + portail du logo en deux calques (images de apps/web/public/tcg) ; seule la
 * galaxie tourne. Ratio 360/504, comme la face : la largeur suit le parent.
 */

// Rayons et étoiles précalculés (déterministes : même rendu serveur et client)
const RAYS = Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * Math.PI * 2;
  return {
    x: +(180 + Math.cos(a) * 420).toFixed(1),
    y: +(232 + Math.sin(a) * 420).toFixed(1),
    color: i % 2 ? "#ff2d7a" : "#67e8f9",
    width: i % 4 === 0 ? 2 : 1,
  };
});

const STARS = (() => {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: 40 }, () => {
    const x = +(34 + rnd() * 292).toFixed(1);
    const y = +(34 + rnd() * 410).toFixed(1);
    const r = rnd() < 0.15 ? 1.4 : 0.8;
    const o = +(0.25 + rnd() * 0.6).toFixed(2);
    return { x, y, r, o };
  });
})();

// Forme de l'ouverture de l'arche (en % de l'image du portail)
const DOOR_CLIP =
  "polygon(48.93% 38.57%, 48.93% 38.87%, 48.93% 39.45%, 46.29% 40.04%, 44.82% 40.62%, 43.26% 41.21%, 43.26% 41.80%, 42.58% 42.38%, 41.21% 42.97%, 41.21% 43.55%, 41.21% 44.14%, 41.21% 44.73%, 40.04% 45.31%, 40.04% 45.90%, 40.04% 46.48%, 40.04% 47.07%, 40.04% 47.66%, 38.67% 48.24%, 38.67% 48.83%, 38.67% 49.41%, 38.67% 50.00%, 38.67% 50.59%, 38.67% 51.17%, 38.67% 51.76%, 38.67% 52.34%, 38.67% 52.93%, 38.67% 53.52%, 38.67% 54.10%, 38.67% 54.69%, 38.67% 55.27%, 38.67% 55.86%, 38.67% 56.45%, 38.67% 57.03%, 38.67% 57.62%, 38.67% 58.20%, 38.67% 58.79%, 38.67% 59.38%, 38.67% 59.96%, 38.67% 60.55%, 38.67% 61.13%, 38.67% 61.72%, 38.67% 62.30%, 38.67% 62.89%, 38.67% 63.48%, 38.67% 64.06%, 38.67% 64.65%, 38.67% 65.23%, 38.67% 65.82%, 38.67% 66.41%, 38.67% 66.99%, 38.67% 67.58%, 38.67% 68.16%, 38.67% 68.75%, 38.67% 69.34%, 38.67% 69.92%, 38.67% 70.51%, 38.67% 71.09%, 38.67% 71.68%, 38.67% 72.27%, 40.14% 74.02%, 40.14% 74.41%, 59.77% 74.41%, 59.77% 74.02%, 61.23% 72.27%, 61.23% 71.68%, 61.23% 71.09%, 61.23% 70.51%, 61.23% 69.92%, 61.23% 69.34%, 61.23% 68.75%, 61.23% 68.16%, 61.23% 67.58%, 61.23% 66.99%, 61.23% 66.41%, 61.23% 65.82%, 61.23% 65.23%, 61.23% 64.65%, 61.23% 64.06%, 61.23% 63.48%, 61.23% 62.89%, 61.23% 62.30%, 61.23% 61.72%, 61.23% 61.13%, 61.23% 60.55%, 61.23% 59.96%, 61.23% 59.38%, 61.23% 58.79%, 61.23% 58.20%, 61.23% 57.62%, 61.23% 57.03%, 61.23% 56.45%, 61.23% 55.86%, 61.23% 55.27%, 61.23% 54.69%, 61.23% 54.10%, 61.13% 53.52%, 61.13% 52.93%, 61.13% 52.34%, 61.13% 51.76%, 61.13% 51.17%, 61.13% 50.59%, 61.13% 50.00%, 61.13% 49.41%, 61.13% 48.83%, 61.13% 48.24%, 59.67% 47.66%, 59.67% 47.07%, 59.77% 46.48%, 59.77% 45.90%, 59.67% 45.31%, 58.50% 44.73%, 58.50% 44.14%, 58.50% 43.55%, 58.30% 42.97%, 57.13% 42.38%, 56.54% 41.80%, 56.05% 41.21%, 54.49% 40.62%, 53.42% 40.04%, 51.07% 39.45%, 51.07% 38.87%, 51.07% 38.57%)";

const GEM_OUTER = "-3.1,-7.5 3.1,-7.5 7.5,-3.1 7.5,3.1 3.1,7.5 -3.1,7.5 -7.5,3.1 -7.5,-3.1";
const GEM_TABLE = "-1.5,-3.6 1.5,-3.6 3.6,-1.5 3.6,1.5 1.5,3.6 -1.5,3.6 -3.6,1.5 -3.6,-1.5";
const points = (s: string) => s.split(" ").map((p) => p.split(",").map(Number));
// Arêtes des facettes : chaque sommet du contour relié au sommet correspondant de la table.
const FACETS = points(GEM_OUTER).map(([x1, y1], i) => {
  const [x2, y2] = points(GEM_TABLE)[i] ?? [0, 0];
  return { x1, y1, x2, y2 };
});

function Gem({ x, y, fill, gold }: { x: number; y: number; fill: string; gold: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={GEM_OUTER} fill={fill} stroke={gold} strokeWidth={1.2} />
      {FACETS.map((f, i) => (
        <line
          key={i}
          x1={f.x1}
          y1={f.y1}
          x2={f.x2}
          y2={f.y2}
          stroke="#fff"
          strokeOpacity={0.4}
          strokeWidth={0.5}
        />
      ))}
      <polygon points={GEM_TABLE} fill="#fff" fillOpacity={0.28} />
      <circle cx={-2} cy={-3} r={1.2} fill="#fff" fillOpacity={0.9} />
    </g>
  );
}

export function CardBack({
  assetsBase = "/tcg",
  animated = true,
}: {
  /** Dossier public des images du portail (sans slash final). */
  assetsBase?: string;
  /** false = galaxie figée (sinon elle tourne, sauf prefers-reduced-motion). */
  animated?: boolean;
}) {
  // Identifiants SVG uniques : plusieurs dos sur la même page ne se gênent pas.
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <div className="tcg-back">
      <svg viewBox="0 0 360 504" className="tcg-back-svg" aria-hidden="true">
        <defs>
          <radialGradient id={id("space")} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0" stopColor="#2a1660" />
            <stop offset="0.45" stopColor="#0d1236" />
            <stop offset="1" stopColor="#03040d" />
          </radialGradient>
          <radialGradient id={id("aura")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff2d7a" stopOpacity={0.35} />
            <stop offset="0.5" stopColor="#a855f7" stopOpacity={0.18} />
            <stop offset="1" stopColor="#a855f7" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={id("metal")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9ea4bb" />
            <stop offset="0.18" stopColor="#3a3f58" />
            <stop offset="0.42" stopColor="#d9dcea" />
            <stop offset="0.6" stopColor="#2b2f45" />
            <stop offset="0.82" stopColor="#8f96ad" />
            <stop offset="1" stopColor="#1c1f30" />
          </linearGradient>
          <linearGradient id={id("gold")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="0.5" stopColor="#e0a93a" />
            <stop offset="1" stopColor="#8a5a14" />
          </linearGradient>
          <radialGradient id={id("gemC")} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#cffafe" />
            <stop offset="0.45" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#0e5a7a" />
          </radialGradient>
          <radialGradient id={id("gemP")} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffe4ef" />
            <stop offset="0.45" stopColor="#ff2d7a" />
            <stop offset="1" stopColor="#7a0f3a" />
          </radialGradient>
          <linearGradient id={id("word")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#67e8f9" />
          </linearGradient>
          <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Fond spatial, rayons, étoiles, aura, anneaux */}
        <rect width="360" height="504" fill={url("space")} />
        {RAYS.map((r, i) => (
          <line
            key={i}
            x1={180}
            y1={232}
            x2={r.x}
            y2={r.y}
            stroke={r.color}
            strokeOpacity={0.09}
            strokeWidth={r.width}
          />
        ))}
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e0e7ff" fillOpacity={s.o} />
        ))}
        <ellipse cx="180" cy="240" rx="150" ry="150" fill={url("aura")} />
        <circle cx="180" cy="232" r="132" fill="none" stroke="#e0a93a" strokeOpacity={0.35} />
        <circle
          cx="180"
          cy="232"
          r="142"
          fill="none"
          stroke="#67e8f9"
          strokeOpacity={0.25}
          strokeDasharray="2 7"
        />
        <path
          d="M180 92 L188 100 L180 108 L172 100 Z"
          fill="none"
          stroke="#e0a93a"
          strokeOpacity={0.6}
        />
        <path
          d="M180 356 L188 364 L180 372 L172 364 Z"
          fill="none"
          stroke="#e0a93a"
          strokeOpacity={0.6}
        />

        {/* Cadre métallique */}
        <path
          fillRule="evenodd"
          fill={url("metal")}
          d="M26 4 H334 A22 22 0 0 1 356 26 V478 A22 22 0 0 1 334 500 H26 A22 22 0 0 1 4 478 V26 A22 22 0 0 1 26 4 Z M25 11 H335 A14 14 0 0 1 349 25 V479 A14 14 0 0 1 335 493 H25 A14 14 0 0 1 11 479 V25 A14 14 0 0 1 25 11 Z"
        />
        <rect
          x="4.5"
          y="4.5"
          width="351"
          height="495"
          rx="21.5"
          fill="none"
          stroke="#000"
          strokeOpacity={0.6}
        />
        <rect
          x="11"
          y="11"
          width="338"
          height="482"
          rx="14"
          fill="none"
          stroke="#fff"
          strokeOpacity={0.3}
        />
        <rect
          x="15"
          y="15"
          width="330"
          height="474"
          rx="11"
          fill="none"
          stroke={url("gold")}
          strokeWidth={1.5}
        />
        <rect
          x="20"
          y="20"
          width="320"
          height="464"
          rx="8"
          fill="none"
          stroke="#67e8f9"
          strokeOpacity={0.25}
        />

        {/* Plaques d'angle + gemmes */}
        <polygon points="4,52 4,26 26,4 52,4 44,11 28,11 11,28 11,44" fill={url("gold")} />
        <polygon
          points="356,52 356,26 334,4 308,4 316,11 332,11 349,28 349,44"
          fill={url("gold")}
        />
        <polygon
          points="4,452 4,478 26,500 52,500 44,493 28,493 11,476 11,460"
          fill={url("gold")}
        />
        <polygon
          points="356,452 356,478 334,500 308,500 316,493 332,493 349,476 349,460"
          fill={url("gold")}
        />
        <g filter={url("glow")}>
          <Gem x={20} y={20} fill={url("gemC")} gold={url("gold")} />
          <Gem x={340} y={20} fill={url("gemC")} gold={url("gold")} />
          <Gem x={20} y={484} fill={url("gemP")} gold={url("gold")} />
          <Gem x={340} y={484} fill={url("gemP")} gold={url("gold")} />
        </g>

        {/* Plaque du haut */}
        <polygon
          points="134,4 226,4 216,19 144,19"
          fill={url("metal")}
          stroke={url("gold")}
          strokeWidth={1.5}
        />
        <path d="M180 5 L187 11.5 L180 18 L173 11.5 Z" fill="#ff2d7a" filter={url("glow")} />

        {/* Cartouche POTOMON */}
        <polygon
          points="92,500 268,500 252,452 108,452"
          fill="#0a0e24"
          stroke={url("gold")}
          strokeWidth={1.5}
        />
        <polygon
          points="98,500 262,500 248,458 112,458"
          fill="none"
          stroke="#67e8f9"
          strokeOpacity={0.35}
        />
        <text
          x="180"
          y="487"
          textAnchor="middle"
          fontFamily="var(--font-rajdhani, Rajdhani), sans-serif"
          fontWeight={700}
          fontStyle="italic"
          fontSize={25}
          letterSpacing={4}
          fill={url("word")}
          filter={url("glow")}
        >
          POTOMON
        </text>
      </svg>

      {/* Portail : galaxie dessous (découpée à la forme de la porte), cadre du logo dessus */}
      <div className="tcg-back-portal">
        <div className="tcg-back-door" style={{ clipPath: DOOR_CLIP }}>
          <img
            src={`${assetsBase}/portal-galaxy.webp`}
            alt=""
            className={animated ? "tcg-back-galaxy tcg-back-spin" : "tcg-back-galaxy"}
            draggable={false}
          />
        </div>
        <img
          src={`${assetsBase}/portal-frame.webp`}
          alt=""
          className="tcg-back-frame"
          draggable={false}
        />
      </div>
    </div>
  );
}
