import type { CSSProperties } from "react";

// Prime écrite à l'anglaise, comme sur les affiches : « 1,500,000- ».
const bountyFormat = new Intl.NumberFormat("en-US");

type Props = {
  name: string;
  image: string | null;
  /** Prime affichée : le solde du membre. */
  bounty: number;
};

/**
 * Avis de recherche du membre (thème One Piece) : vraie affiche « WANTED / DEAD OR ALIVE /
 * MARINE » vierge (public/onepiece/wanted-blank.webp), avec la photo de profil sous sa fenêtre,
 * le nom et la prime écrits dessus, et le chapeau de paille accroché au coin. Rendu pour tous les
 * thèmes mais affiché seulement par celui-ci (theme.css), où il remplace la ligne du profil et le
 * solde dans le cadre du compte.
 */
export function WantedPoster({ name, image, bounty }: Props) {
  const amount = `${bountyFormat.format(bounty)}-`;
  return (
    <div
      className="op-wanted"
      role="img"
      aria-label={`Avis de recherche : ${name}, prime ${amount}`}
    >
      <div className="op-wanted-paper">
        <span className="op-wanted-photo">
          {image ? <img src={image} alt="" /> : name.slice(0, 1).toUpperCase()}
        </span>
        {/* lazy : l'affiche est masquée hors du thème One Piece, elle ne s'y télécharge pas */}
        <img src="/onepiece/wanted-blank.webp" alt="" loading="lazy" className="op-wanted-sheet" />
        <span
          className="op-wanted-name"
          style={{ "--len": Math.max(name.length, 1) } as CSSProperties}
        >
          {name}
        </span>
        <span className="op-wanted-bounty">{amount}</span>
      </div>
      <span className="op-wanted-hat" />
    </div>
  );
}
