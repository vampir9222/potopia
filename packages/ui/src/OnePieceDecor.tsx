import type { CSSProperties } from "react";

/** Valeur pseudo-aléatoire stable dans [0, 1) : même rendu côté serveur et client. */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Vague en SVG sur deux largeurs d'écran : 8 périodes identiques, pour qu'un décalage de la moitié
 * (animation `op-swell`) retombe exactement sur le même dessin et boucle sans à-coup.
 */
function wavePath(height: number, amplitude: number): string {
  const mid = height * 0.35;
  let d = `M0 ${mid} Q50 ${mid - amplitude} 100 ${mid}`;
  for (let x = 200; x <= 1600; x += 100) d += ` T${x} ${mid}`;
  return `${d} L1600 ${height} L0 ${height} Z`;
}

const WAVES = [
  { className: "op-wave op-wave-back", height: 60, amplitude: 9 },
  { className: "op-wave op-wave-mid", height: 60, amplitude: 12 },
  { className: "op-wave op-wave-front", height: 60, amplitude: 15 },
];

// Le pavillon est découpé en bandes verticales qui ondulent chacune avec un léger retard : le
// tissu a l'air de flotter au vent, crâne compris.
// (pavillon de 150 × 100 px, bandes de 10 px qui se chevauchent d'un demi-pixel)
const FLAG_SLICES = 15;
const SLICE_PX = 10;

/**
 * Décor du thème One Piece, en fond : nuit sur la mer (lune, étoiles, horizon), houle sur trois
 * plans, un navire au loin qui traverse l'horizon, mouettes, le pavillon au chapeau de paille qui
 * flotte, l'avis de recherche de Luffy épinglé, et des « ドン!! » de manga qui claquent de temps en
 * temps. Affiché seulement par ce thème (--onepiece), décoratif (aria-hidden, aucun clic).
 */
export function OnePieceDecor() {
  return (
    <div aria-hidden className="op-decor pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="op-sky" />
      <span className="op-moon" />
      {/* reflet de la lune qui scintille sur la mer */}
      <span className="op-moon-glint" />
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={`s${i}`}
          className="op-star"
          style={{
            left: `${seeded(i, 1) * 100}%`,
            top: `${seeded(i, 2) * 62}%`,
            width: 1 + seeded(i, 3) * 2,
            height: 1 + seeded(i, 3) * 2,
            animationDuration: `${2.5 + seeded(i, 4) * 4}s`,
            animationDelay: `${-seeded(i, 5) * 6}s`,
          }}
        />
      ))}

      {/* navire au loin : traverse l'horizon très lentement en tanguant */}
      <div className="op-ship-track">
        <svg viewBox="0 0 220 110" className="op-ship">
          <path className="op-ship-sail" d="M78 18 Q104 26 132 18 L134 64 Q104 72 76 64 Z" />
          <path className="op-ship-sail" d="M138 34 Q154 39 170 34 L171 64 Q154 69 137 64 Z" />
          <path className="op-ship-hull" d="M104 4 V76 M154 22 V76 M60 50 L104 40" />
          <path className="op-ship-flag" d="M104 4 L124 8 L104 13 Z" />
          <path
            className="op-ship-body"
            d="M18 70 Q24 96 66 99 L162 99 Q194 96 204 72 L172 77 L52 77 Z"
          />
          {/* tête de mouton à la proue */}
          <circle className="op-ship-body" cx="206" cy="66" r="8" />
          <circle className="op-ship-sail" cx="104" cy="44" r="7" />
        </svg>
      </div>

      {Array.from({ length: 4 }, (_, i) => (
        <span
          key={`g${i}`}
          className="op-gull"
          style={
            {
              top: `${10 + seeded(i, 6) * 30}%`,
              animationDuration: `${46 + seeded(i, 7) * 30}s`,
              animationDelay: `${-seeded(i, 8) * 70}s`,
              "--gull-rise": `${(seeded(i, 9) - 0.5) * 18}vh`,
              "--gull-size": `${0.7 + seeded(i, 10) * 0.6}`,
            } as CSSProperties
          }
        >
          <svg
            viewBox="0 0 24 10"
            className="op-gull-wings"
            style={{ animationDuration: `${0.5 + seeded(i, 11) * 0.4}s` }}
          >
            <path d="M1 7 Q6 0 12 7 Q18 0 23 7" />
          </svg>
        </span>
      ))}

      <div className="op-flag">
        <span className="op-flag-pole" />
        {Array.from({ length: FLAG_SLICES }, (_, i) => (
          <span
            key={`f${i}`}
            className="op-flag-slice"
            style={
              {
                left: i * SLICE_PX,
                width: SLICE_PX + 0.5,
                backgroundPosition: `${-i * SLICE_PX}px 0`,
                animationDelay: `${-i * 0.11}s`,
                // le bout du pavillon flotte plus que le côté du mât
                "--flag-amp": `${1 + i * 0.32}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="op-wanted">
        <span className="op-wanted-title">WANTED</span>
        <span className="op-wanted-photo" />
        <span className="op-wanted-doa">DEAD OR ALIVE</span>
        <span className="op-wanted-name">MONKEY·D·LUFFY</span>
        <span className="op-wanted-bounty">฿ 3.000.000.000-</span>
      </div>

      {Array.from({ length: 3 }, (_, i) => (
        <span
          key={`d${i}`}
          className="op-don"
          style={
            {
              left: `${12 + seeded(i, 12) * 70}%`,
              top: `${14 + seeded(i, 13) * 50}%`,
              fontSize: `${48 + seeded(i, 14) * 40}px`,
              animationDuration: `${11 + seeded(i, 15) * 7}s`,
              animationDelay: `${-seeded(i, 16) * 18}s`,
              "--don-tilt": `${(seeded(i, 17) - 0.5) * 24}deg`,
            } as CSSProperties
          }
        >
          ドン!!
        </span>
      ))}

      <div className="op-sea">
        {WAVES.map((w) => (
          <svg
            key={w.className}
            viewBox={`0 0 1600 ${w.height}`}
            preserveAspectRatio="none"
            className={w.className}
          >
            <path d={wavePath(w.height, w.amplitude)} />
          </svg>
        ))}
      </div>
    </div>
  );
}
