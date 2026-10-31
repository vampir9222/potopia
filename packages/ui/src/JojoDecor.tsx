import type { CSSProperties } from "react";

/** Valeur pseudo-aléatoire stable dans [0, 1) : même rendu côté serveur et client. */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Portraits pixel art du jeu de Capcom (public/jojo de l'app), en grand et à peine visibles,
// estompés vers le centre : Jotaro et Star Platinum en bas à gauche, DIO et The World en haut à
// droite, comme deux camps qui se font face.
const PORTRAITS = [
  { src: "/jojo/portrait-star-platinum.png", className: "jojo-portrait jojo-portrait-sp" },
  { src: "/jojo/portrait-jotaro.png", className: "jojo-portrait jojo-portrait-jotaro" },
  { src: "/jojo/portrait-the-world.png", className: "jojo-portrait jojo-portrait-tw" },
  { src: "/jojo/portrait-dio.png", className: "jojo-portrait jojo-portrait-dio" },
];

/**
 * Décor du thème JoJo (Stardust Crusaders), en fond : trame manga, rayons dorés qui tournent
 * lentement, portraits des deux camps, « ゴゴゴ » qui montent, étoiles Joestar qui scintillent, et
 * Jotaro qui prend la pose dans un coin. Affiché seulement par ce thème (--jojo), décoratif
 * (aria-hidden, aucun clic), figé si l'appareil demande moins d'animations.
 */
export function JojoDecor() {
  return (
    <div aria-hidden className="jojo-decor pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="jojo-rays" />
      <div className="jojo-tone" />
      {PORTRAITS.map((p) => (
        <span key={p.src} className={p.className} style={{ backgroundImage: `url(${p.src})` }} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={`m${i}`}
          className="jojo-menace"
          style={
            {
              left: `${6 + seeded(i, 1) * 88}%`,
              height: `${54 + seeded(i, 2) * 56}px`,
              animationDuration: `${16 + seeded(i, 3) * 14}s`,
              animationDelay: `${-seeded(i, 4) * 30}s`,
              "--menace-sway": `${(seeded(i, 5) - 0.5) * 120}px`,
              "--menace-tilt": `${(seeded(i, 6) - 0.5) * 30}deg`,
            } as CSSProperties
          }
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={`s${i}`}
          className="jojo-star"
          style={{
            left: `${seeded(i, 7) * 100}%`,
            top: `${seeded(i, 8) * 100}%`,
            width: 8 + seeded(i, 9) * 10,
            height: 8 + seeded(i, 9) * 10,
            animationDuration: `${3 + seeded(i, 10) * 4}s`,
            animationDelay: `${-seeded(i, 11) * 6}s`,
          }}
        />
      ))}
      <span className="jojo-pose" />
    </div>
  );
}
