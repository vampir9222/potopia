/** Événement écouté par l'effet « ドン!! » de l'app (`apps/web/components/Don`). */
export const DON_EVENT = "app:don";

/**
 * « ドン!! » façon manga : coup de tambour, flash, lignes de vitesse et onomatopée qui claque au
 * milieu de l'écran. Déclenché en passant au thème One Piece ; sans effet monté, rien ne se passe.
 */
export function don(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DON_EVENT));
}
