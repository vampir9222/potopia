/**
 * Source unique du nom de la plateforme et de la monnaie.
 * Nom de code susceptible de changer : ne jamais écrire ces noms en dur ailleurs.
 * (Les schémas DB, tables et packages utilisent des noms fonctionnels, jamais la marque.)
 */
export const BRAND = {
  name: "Potopia",
  /** Logo du site, aussi utilisé comme favicon (fichier servi par apps/web/public). */
  logo: "/brand/logo.png",
  currency: {
    name: "PotoCoin",
    plural: "PotoCoins",
    symbol: "PC",
    /** Pièce affichée à côté des montants (fichier servi par apps/web/public). */
    icon: "/brand/currency.svg",
  },
  locale: "fr-FR",
  /**
   * Fuseau d'affichage des dates : le serveur tourne en UTC (Vercel) et les navigateurs des membres
   * sont en France ; sans fuseau explicite, serveur et client formateraient des heures différentes.
   */
  timeZone: "Europe/Paris",
} as const;

export type Brand = typeof BRAND;

/** Formate un montant entier de monnaie : `formatCurrency(1500)` → "1 500 PotoCoins". */
export function formatCurrency(amount: number): string {
  const n = new Intl.NumberFormat(BRAND.locale).format(amount);
  const unit = Math.abs(amount) <= 1 ? BRAND.currency.name : BRAND.currency.plural;
  return `${n} ${unit}`;
}
