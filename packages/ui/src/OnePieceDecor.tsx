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

function Wave({ className, amplitude }: { className: string; amplitude: number }) {
  return (
    <svg viewBox="0 0 1600 60" preserveAspectRatio="none" className={`op-wave ${className}`}>
      <path d={wavePath(60, amplitude)} />
    </svg>
  );
}

// Images de public/onepiece (app) : portraits de l'équipage (One Piece: Gigant Battle), avis de
// recherche, Thousand Sunny et Vogue Merry.
const IMG = (name: string) => `/onepiece/${name}.webp`;

// L'équipage défile dans deux coins, un membre après l'autre (fondu enchaîné) : chacun reste
// CREW_STEP secondes, la boucle dure CREW_STEP × nombre de membres du coin.
const CREW_STEP = 9;
const CREW_LEFT = ["luffy", "zoro", "usopp", "franky", "jinbe"];
const CREW_RIGHT = ["nami", "sanji", "robin", "chopper"];

// Avis de recherche épinglés un peu partout (position, inclinaison) ; au centre, les cartes du
// site en cachent une partie, on les devine entre deux.
const POSTERS = [
  { name: "luffy", left: "1.5vw", top: "14vh", tilt: -6 },
  { name: "zoro", left: "12vw", top: "31vh", tilt: 5 },
  { name: "nami", left: "22vw", top: "11vh", tilt: -3 },
  { name: "chopper", left: "31vw", top: "40vh", tilt: 4 },
  { name: "sanji", left: "41vw", top: "8vh", tilt: 7 },
  { name: "usopp", left: "52vw", top: "30vh", tilt: -8 },
  { name: "brook", right: "29vw", top: "11vh", tilt: 3 },
  { name: "robin", right: "15vw", top: "33vh", tilt: 6 },
  { name: "franky", right: "2.5vw", top: "27vh", tilt: -5 },
] as const;

// Le pavillon est découpé en bandes verticales qui ondulent chacune avec un léger retard : le
// tissu a l'air de flotter au vent, crâne compris.
// (pavillon de 150 × 100 px, bandes de 10 px qui se chevauchent d'un demi-pixel)
const FLAG_SLICES = 15;
const SLICE_PX = 10;

/** Fondu enchaîné des membres d'un coin : chacun son tour, sur la même boucle. */
function CrewCorner({ side, crew }: { side: "left" | "right"; crew: string[] }) {
  return (
    <div className={`op-crew op-crew-${side}`}>
      {crew.map((name, i) => (
        <span
          key={name}
          className="op-crew-member"
          style={{
            backgroundImage: `url(${IMG(`crew-${name}`)})`,
            animationDuration: `${CREW_STEP * crew.length}s`,
            animationDelay: `${i * CREW_STEP - CREW_STEP * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Décor du thème One Piece, en fond : nuit sur la mer (lune et son reflet, étoiles), houle sur
 * trois plans où navigue le Thousand Sunny (et le Vogue Merry au loin, sur l'horizon), mouettes,
 * chapeau de paille emporté par le vent, pavillon qui flotte devant la lune, l'équipage qui défile
 * dans les coins, les avis de recherche de tout l'équipage épinglés, et des « ドン!! » de manga.
 * Affiché seulement par ce thème (--onepiece), décoratif (aria-hidden, aucun clic).
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

      <CrewCorner side="left" crew={CREW_LEFT} />
      <CrewCorner side="right" crew={CREW_RIGHT} />

      {POSTERS.map((p, i) => (
        <span
          key={p.name}
          className="op-poster"
          style={
            {
              left: "left" in p ? p.left : undefined,
              right: "right" in p ? p.right : undefined,
              top: p.top,
              backgroundImage: `url(${IMG(`wanted-${p.name}`)})`,
              "--poster-tilt": `${p.tilt}deg`,
              animationDuration: `${6 + seeded(i, 20) * 4}s`,
              animationDelay: `${-seeded(i, 21) * 8}s`,
            } as CSSProperties
          }
        />
      ))}

      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={`g${i}`}
          className="op-gull"
          style={
            {
              top: `${8 + seeded(i, 6) * 32}%`,
              animationDuration: `${40 + seeded(i, 7) * 30}s`,
              animationDelay: `${-seeded(i, 8) * 70}s`,
              "--gull-rise": `${(seeded(i, 9) - 0.5) * 18}vh`,
              "--gull-size": `${0.7 + seeded(i, 10) * 0.7}`,
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

      {/* le chapeau de paille, emporté par le vent, traverse le ciel en tournoyant */}
      <span className="op-hat-track">
        <svg viewBox="0 0 160 70" className="op-hat">
          <path d="M42 40 C42 8 118 8 118 40 Z" fill="#f2c23a" stroke="#8a5f10" strokeWidth="3" />
          <path d="M42.6 30 C60 34 100 34 117.4 30 L118 40 L42 40 Z" fill="#d8342b" />
          <ellipse
            cx="80"
            cy="44"
            rx="76"
            ry="14"
            fill="#f2c23a"
            stroke="#8a5f10"
            strokeWidth="3"
          />
          <path d="M14 45 q66 9 132 0" fill="none" stroke="#c9961f" strokeWidth="2" />
        </svg>
      </span>

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

      {/* la mer : le Merry au loin sur l'horizon, le Sunny entre deux vagues (sa coque plonge
          derrière la houle du premier plan) */}
      <div className="op-sea">
        <span className="op-merry-track">
          <span className="op-merry" style={{ backgroundImage: `url(${IMG("merry")})` }} />
        </span>
        <Wave className="op-wave-back" amplitude={9} />
        <span className="op-sunny-track">
          <span className="op-sunny" style={{ backgroundImage: `url(${IMG("sunny")})` }} />
        </span>
        <Wave className="op-wave-mid" amplitude={12} />
        <Wave className="op-wave-front" amplitude={15} />
      </div>
    </div>
  );
}
