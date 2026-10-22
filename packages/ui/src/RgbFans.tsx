import type { CSSProperties } from "react";

const BLADES = 9;
const SCREWS = [
  [22, 22],
  [178, 22],
  [22, 178],
  [178, 178],
] as const;

/** Un ventilateur de PC : cadre carré vissé, anneau lumineux, pales inclinées qui tournent. */
function Fan({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" className="rgb-fan" style={style}>
      <rect
        x="4"
        y="4"
        width="192"
        height="192"
        rx="22"
        fill="none"
        stroke="var(--border)"
        strokeWidth="4"
      />
      {SCREWS.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="6"
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
        />
      ))}
      <circle cx="100" cy="100" r="90" fill="none" stroke="var(--accent)" strokeWidth="6" />
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

/**
 * Ventilateurs RGB en fond, pour le thème RGB (masqués par les autres thèmes via --fans).
 * Décoratif uniquement : aria-hidden, aucun clic.
 */
export function RgbFans() {
  return (
    <div aria-hidden className="rgb-fans pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Fan style={{ width: 520, height: 520, right: -140, bottom: -140 }} />
      <Fan style={{ width: 300, height: 300, left: -90, top: 70 }} />
    </div>
  );
}
