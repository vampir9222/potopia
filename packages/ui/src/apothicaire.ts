/** Événement écouté par l'ouverture du thème Apothicaire (`apps/web/components/ApothicaireOpening`). */
export const APOTHICAIRE_EVENT = "app:apothicaire";

/**
 * Ouverture du thème Apothicaire (Les Carnets de l'apothicaire) : un rouleau se déroule sur le
 * titre 「薬屋のひとりごと」 et les premières notes de l'opening. Déclenché en passant à ce thème ;
 * sans effet monté, rien ne se passe.
 */
export function apothicaire(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(APOTHICAIRE_EVENT));
}
