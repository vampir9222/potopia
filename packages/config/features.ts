/** Réglage serveur : retire le module et ses accès sans supprimer ses données. */
export function isGotyEnabled(): boolean {
  return process.env.GOTY_ENABLED === undefined || process.env.GOTY_ENABLED === "true";
}
