import { apps } from "@app/core";
import { BreadcrumbNav } from "./BreadcrumbNav";

/**
 * Libellés des sections qui ne sont pas des apps du registre (par segment, ou par chemin complet
 * quand le segment seul est ambigu). Ajouter ici les nouvelles sections.
 */
const SECTION_LABELS: Record<string, string> = {
  "admin/cartes": "Cartes",
  "admin/cartes/illustrations": "Illustrations",
  "admin/cartes/import": "Import",
  "admin/cartes/nouvelle": "Nouvelle carte",
  "admin/mascotte": "Mascotte",
  avatar: "Mon avatar",
  credits: "Crédits",
  economy: "Monnaie",
  inventaire: "Mon inventaire",
  parametres: "Paramètres",
  wallet: "Ma monnaie",
};

/**
 * Libellés volontairement plus courts que le nom de l'app dans le registre : le fil d'Ariane doit
 * tenir sur une ligne, et la page affiche déjà son titre complet.
 */
const SHORT_LABELS: Record<string, string> = {
  cartes: "Design des cartes",
};

/** Apps du registre (`/trois` → « TROIS »), puis sections : une seule source pour les noms d'apps. */
const LABELS: Record<string, string> = {
  ...Object.fromEntries(apps.map((app) => [app.route.replace(/^\//, ""), app.name])),
  ...SHORT_LABELS,
  ...SECTION_LABELS,
};

/**
 * Fil d'Ariane des pages : composant serveur, qui lit le registre des apps (code serveur) et ne
 * transmet au composant client que les libellés.
 */
export function Breadcrumb() {
  return <BreadcrumbNav labels={LABELS} />;
}
