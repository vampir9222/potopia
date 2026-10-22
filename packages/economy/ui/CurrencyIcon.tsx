import { BRAND } from "@app/config/brand";

type Props = {
  className?: string;
  /** Décorative quand le nom de la monnaie est déjà donné à côté (lecteurs d'écran). */
  decorative?: boolean;
};

/** Pièce de la monnaie, à la place du symbole texte. Taille à donner via `className`. */
export function CurrencyIcon({ className = "size-4", decorative = false }: Props) {
  return (
    <img
      src={BRAND.currency.icon}
      alt={decorative ? "" : BRAND.currency.symbol}
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
    />
  );
}
