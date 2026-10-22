/*
 * Décor du thème RGB : une boucle de watercooling en fond (radiateur à deux ventilateurs, réservoir
 * avec pompe, tubes où circule le liquide). Masqué par les autres thèmes via --fans.
 * Coordonnées dans un viewBox 1600×900 recadré pour couvrir l'écran.
 */

const BLADES = 9;

/** Aller (réservoir → radiateur, par le haut) et retour (radiateur → réservoir, par le bas). */
const HOT_TUBE = "M150 430 L150 190 Q150 150 190 150 L1390 150 Q1430 150 1430 190 L1430 250";
const COLD_TUBE = "M1430 850 L1430 870 Q1430 880 1420 880 L160 880 Q150 880 150 870 L150 830";

/** Un ventilateur de 200×200 placé en (x, y) : anneau lumineux, pales inclinées qui tournent. */
function Fan({ x, y }: { x: number; y: number }) {
  return (
    <svg x={x} y={y} width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="92" fill="none" stroke="var(--accent)" strokeWidth="6" />
      <g className="rgb-fan-blades">
        {Array.from({ length: BLADES }, (_, i) => (
          <path
            key={i}
            d="M112 94 C 132 66, 158 52, 184 58 C 166 80, 140 98, 116 106 Z"
            fill="var(--accent)"
            fillOpacity="0.45"
            stroke="var(--accent)"
            strokeOpacity="0.8"
            strokeWidth="1"
            transform={`rotate(${(360 / BLADES) * i} 100 100)`}
          />
        ))}
      </g>
      <circle
        cx="100"
        cy="100"
        r="22"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="3"
      />
      <circle cx="100" cy="100" r="9" fill="var(--accent)" fillOpacity="0.6" />
    </svg>
  );
}

/** Tube rigide : gaine sombre, liquide lumineux qui avance, bulles qui suivent le circuit. */
function Tube({ id, d, duration }: { id: string; d: string; duration: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke="var(--border)" strokeWidth="22" strokeLinecap="round" />
      <path
        id={id}
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.35"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path d={d} className="rgb-coolant" fill="none" strokeWidth="8" strokeLinecap="round" />
      {Array.from({ length: 5 }, (_, i) => (
        <circle key={i} r={3 + (i % 3)} className="rgb-bubble" fill="var(--text)" fillOpacity="0.7">
          <animateMotion
            dur={`${duration}s`}
            begin={`${(-duration * i) / 5}s`}
            repeatCount="indefinite"
          >
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      ))}
    </g>
  );
}

export function RgbFans() {
  return (
    <div aria-hidden className="rgb-fans pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        className="rgb-rig h-full w-full"
      >
        <Tube id="rgb-hot-tube" d={HOT_TUBE} duration={9} />
        <Tube id="rgb-cold-tube" d={COLD_TUBE} duration={9} />

        {/* radiateur : cadre et ailettes, deux ventilateurs */}
        <rect
          x="1320"
          y="250"
          width="220"
          height="600"
          rx="24"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="6"
        />
        {Array.from({ length: 14 }, (_, i) => (
          <line
            key={i}
            x1="1334"
            x2="1526"
            y1={280 + i * 41}
            y2={280 + i * 41}
            stroke="var(--border)"
            strokeWidth="2"
          />
        ))}
        <Fan x={1330} y={300} />
        <Fan x={1330} y={600} />

        {/* réservoir et pompe : liquide qui ondule, bulles qui montent */}
        <rect
          x="95"
          y="430"
          width="110"
          height="400"
          rx="20"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="6"
        />
        <clipPath id="rgb-reservoir">
          <rect x="101" y="436" width="98" height="388" rx="16" />
        </clipPath>
        <g clipPath="url(#rgb-reservoir)">
          <path
            className="rgb-wave"
            d="M40 560 Q 65 548 90 560 T 140 560 T 190 560 T 240 560 T 290 560 L 290 840 L 40 840 Z"
            fill="var(--accent)"
            fillOpacity="0.45"
          />
          {Array.from({ length: 7 }, (_, i) => (
            <circle
              key={i}
              cx={115 + ((i * 37) % 70)}
              cy="830"
              r={3 + (i % 3) * 2}
              className="rgb-bubble rgb-rise"
              fill="var(--text)"
              fillOpacity="0.6"
              style={{ animationDelay: `${-i * 0.6}s` }}
            />
          ))}
        </g>
        <rect
          x="85"
          y="410"
          width="130"
          height="30"
          rx="8"
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth="3"
        />
        <rect
          x="80"
          y="820"
          width="140"
          height="44"
          rx="10"
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}
