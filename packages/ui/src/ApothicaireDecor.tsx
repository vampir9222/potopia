import type { CSSProperties } from "react";

/** Valeur pseudo-aléatoire stable dans [0, 1) : même rendu côté serveur et client. */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Les remèdes et poisons du carnet de Mao Mao, écrits à la verticale, qui passent à peine
// visibles dans la nuit : aconit, datura, belladone, ginseng, réalgar, fard au plomb…
const HERBS = ["附子", "曼陀羅華", "毒", "人参", "雄黄", "鉛白", "麻黄", "薬", "甘草", "蘇"];

/**
 * Décor du thème Apothicaire (Les Carnets de l'apothicaire), en fond : le Palais intérieur de
 * nuit sous la Voie lactée (la danse de « fantôme » sur le rempart), pleine lune, nuages qui
 * passent, lanternes rouges du manga qui se balancent, pétales de prunier qui tombent, noms de remèdes et
 * de poisons du carnet de Mao Mao ; Gyokuyou et Lihua en grand, à peine visibles, et en bas à
 * droite Mao Mao et Jinshi en pied (visuels officiels de l'anime, public/apothicaire de l'app ;
 * un clic sur l'un ou l'autre, ou sur la lune, les fait réagir : `ApothicaireFx` de l'app).
 * Affiché seulement par ce thème (--apothicaire), décoratif (aria-hidden, aucun clic), figé si
 * l'appareil demande moins d'animations.
 */
export function ApothicaireDecor() {
  return (
    <div aria-hidden className="apo-decor pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="apo-palace" />
      <div className="apo-moon" />
      <div className="apo-clouds" />
      <div className="apo-veil" />
      <span className="apo-portrait apo-portrait-gyokuyou" />
      <span className="apo-portrait apo-portrait-lihua" />
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={`l${i}`}
          className="apo-lantern"
          style={
            {
              left: `${8 + i * 16 + seeded(i, 1) * 6}%`,
              "--lantern-drop": `${30 + seeded(i, 2) * 90}px`,
              "--lantern-size": `${0.7 + seeded(i, 3) * 0.5}`,
              animationDuration: `${5 + seeded(i, 4) * 4}s`,
              animationDelay: `${-seeded(i, 5) * 8}s`,
            } as CSSProperties
          }
        >
          <span className="apo-lantern-glow" />
        </span>
      ))}
      {HERBS.map((herb, i) => (
        <span
          key={herb}
          className="apo-herb"
          style={
            {
              left: `${4 + seeded(i, 6) * 90}%`,
              fontSize: `${16 + seeded(i, 7) * 18}px`,
              animationDuration: `${38 + seeded(i, 8) * 30}s`,
              animationDelay: `${-seeded(i, 9) * 60}s`,
            } as CSSProperties
          }
        >
          {herb}
        </span>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={`p${i}`}
          className="apo-petal"
          style={
            {
              left: `${seeded(i, 10) * 100}%`,
              "--petal-size": `${8 + seeded(i, 11) * 8}px`,
              "--petal-sway": `${(seeded(i, 12) - 0.5) * 260}px`,
              "--petal-spin": `${(seeded(i, 13) - 0.5) * 1080}deg`,
              animationDuration: `${12 + seeded(i, 14) * 12}s`,
              animationDelay: `${-seeded(i, 15) * 24}s`,
            } as CSSProperties
          }
        />
      ))}
      <span className="apo-jinshi" />
      <span className="apo-maomao" />
    </div>
  );
}
