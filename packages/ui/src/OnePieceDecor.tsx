import type { CSSProperties } from "react";
import { WantedBoard } from "./WantedBoard";

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

// Le grand Sunny en pixel art (public/onepiece/sunny-px.webp, 799 × 789, détouré) et l'équipage à
// bord, en pixel art aussi (One Piece: Gigant Battle 2, planches deck-*.png : cases de w × h,
// pieds en bas). Chacun est placé par ses pieds, en pixels de l'image du Sunny, à K pixels de
// l'image par pixel du sprite (× scale) ; ms : durée d'un tour d'animation, alternate :
// aller-retour. L'avant-plan (sunny-px-front.webp : bastingage de la proue, rambarde du pont) est
// redessiné par-dessus : l'équipage a les jambes dans le navire.
const SHIP_W = 799;
const SHIP_H = 789;
const K = 2.4;
const CREW = [
  // Luffy danse sur la tête de lion de la proue
  { name: "luffy", frames: 3, w: 36, h: 47, x: 72, y: 524, ms: 520, alternate: true },
  // Usopp et Chopper derrière le bastingage de la proue
  { name: "usopp", frames: 4, w: 22, h: 42, x: 178, y: 612, ms: 900, alternate: true },
  { name: "chopper", frames: 4, w: 15, h: 32, x: 228, y: 596, ms: 700, alternate: false },
  // sur la pelouse du pont : Zoro aux haltères, Nami, Sanji en mode amoureux
  { name: "zoro", frames: 2, w: 31, h: 42, x: 312, y: 668, ms: 1400, alternate: false },
  { name: "nami", frames: 14, w: 21, h: 40, x: 384, y: 690, ms: 2400, alternate: false },
  { name: "sanji", frames: 3, w: 39, h: 50, x: 436, y: 692, ms: 420, alternate: true },
  // sur le toit de la cabine arrière : Robin qui lit, Franky ; Brook au violon sur le dôme
  { name: "robin", frames: 2, w: 22, h: 43, x: 530, y: 594, ms: 3200, alternate: false },
  {
    name: "franky",
    frames: 2,
    w: 67,
    h: 54,
    x: 610,
    y: 596,
    ms: 900,
    alternate: false,
    scale: 0.8,
  },
  { name: "brook", frames: 3, w: 23, h: 40, x: 712, y: 514, ms: 600, alternate: true },
];
// pavillons découpés du navire (boîte dans l'image), qui claquent au vent depuis leur mât
const FLAGS = [
  { name: "main", x0: 250, y0: 12, x1: 333, y1: 74, origin: "92% 40%" },
  { name: "aft", x0: 528, y0: 0, x1: 594, y1: 58, origin: "75% 40%" },
];

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/** Le Thousand Sunny, l'équipage à bord et les pavillons au vent. */
function Sunny() {
  return (
    <span className="op-sunny-track">
      <span className="op-sunny">
        {CREW.map((c) => {
          const k = K * (c.scale ?? 1);
          return (
            <span
              key={c.name}
              className="op-deck"
              style={{
                left: pct(c.x - (c.w * k) / 2, SHIP_W),
                top: pct(c.y - c.h * k, SHIP_H),
                width: pct(c.w * k, SHIP_W),
                height: pct(c.h * k, SHIP_H),
                backgroundImage: `url(/onepiece/deck-${c.name}.png)`,
                backgroundSize: `${c.frames * 100}% 100%`,
                animationDuration: `${c.ms}ms`,
                animationTimingFunction: `steps(${c.frames}, jump-none)`,
                animationDirection: c.alternate ? "alternate" : "normal",
              }}
            />
          );
        })}
        <span className="op-sunny-front" />
        {FLAGS.map((f) => (
          <span
            key={f.name}
            className="op-sunny-flag"
            style={{
              left: pct(f.x0, SHIP_W),
              top: pct(f.y0, SHIP_H),
              width: pct(f.x1 - f.x0, SHIP_W),
              height: pct(f.y1 - f.y0, SHIP_H),
              backgroundImage: `url(/onepiece/sunny-flag-${f.name}.png)`,
              transformOrigin: f.origin,
            }}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Décor du thème One Piece, en fond : nuit sur la mer (lune et son reflet, étoiles), houle sur
 * trois plans, le Vogue Merry au loin sur l'horizon, le grand Thousand Sunny en pixel art qui tangue
 * au premier plan avec tout l'équipage à bord (et ses pavillons qui claquent au vent), le
 * panneau des avis de recherche, des mouettes et des « ドン!! » de manga. Affiché seulement par ce
 * thème (--onepiece), décoratif (aria-hidden, aucun clic).
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

      {Array.from({ length: 3 }, (_, i) => (
        <span
          key={`d${i}`}
          className="op-don"
          style={
            {
              // dans le ciel, entre le Sunny et la lune
              left: `${52 + seeded(i, 12) * 30}%`,
              top: `${10 + seeded(i, 13) * 30}%`,
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
          derrière la houle), le panneau planté dans l'eau au premier plan */}
      <div className="op-sea">
        <span className="op-merry-track">
          <span className="op-merry" style={{ backgroundImage: "url(/onepiece/merry.webp)" }} />
        </span>
        <Wave className="op-wave-back" amplitude={9} />
        <Sunny />
        <Wave className="op-wave-mid" amplitude={12} />
        <WantedBoard />
        <Wave className="op-wave-front" amplitude={15} />
      </div>
    </div>
  );
}
