import type { CSSProperties } from "react";
import { OnePieceHaki } from "./OnePieceHaki";

/** Valeur pseudo-aléatoire stable dans [0, 1) : même rendu côté serveur et client. */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Personnages en grand et à peine visibles (public/onepiece de l'app, illustrations officielles
// détourées), estompés vers le bas : Gear 5 qui rit en haut au centre, devant les rayons du
// soleil de Nika, Zoro à côté de la colonne de gauche, Luffy en bas à droite.
const PORTRAITS = ["gear5", "zoro", "luffy"];

/**
 * Décor du thème One Piece, en fond : la carte du monde de nuit qui dérive lentement, les rayons
 * de Nika, Luffy, Zoro et Gear 5, des « ドン!! » de manga, et de temps en temps le Haki des rois
 * qui crépite (OnePieceHaki). Affiché seulement par ce thème (--onepiece), décoratif
 * (aria-hidden, aucun clic), figé si l'appareil demande moins d'animations.
 */
export function OnePieceDecor() {
  return (
    <>
      <div aria-hidden className="op-decor pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="op-map" />
        <div className="op-veil" />
        <div className="op-nika" />
        {PORTRAITS.map((name) => (
          <span
            key={name}
            className={`op-portrait op-portrait-${name}`}
            style={{ backgroundImage: `url(/onepiece/portrait-${name}.webp)` }}
          />
        ))}
        {Array.from({ length: 3 }, (_, i) => (
          <span
            key={`d${i}`}
            className="op-don"
            style={
              {
                left: `${38 + seeded(i, 12) * 40}%`,
                top: `${12 + seeded(i, 13) * 60}%`,
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
      </div>
      <OnePieceHaki />
    </>
  );
}
