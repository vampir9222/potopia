/** Événement écouté par l'overlay « To Be Continued » de l'app (`apps/web/components/ToBeContinued`). */
export const TO_BE_CONTINUED_EVENT = "app:to-be-continued";

/**
 * Défaite : l'écran se fige en sépia sur l'intro de Roundabout, et la flèche « To Be Continued »
 * glisse en bas à gauche (JoJo). Les jeux l'appellent ; sans overlay monté, rien ne se passe.
 */
export function toBeContinued(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TO_BE_CONTINUED_EVENT));
}
