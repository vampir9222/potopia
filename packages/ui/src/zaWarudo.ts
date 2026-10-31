/** Événement écouté par l'effet « ZA WARUDO » de l'app (`apps/web/components/ZaWarudo`). */
export const ZA_WARUDO_EVENT = "app:za-warudo";

/**
 * Arrêt du temps façon DIO : onde qui inverse les couleurs, page figée dans une teinte délavée,
 * puis le temps reprend. Déclenché en passant au thème JoJo ; sans effet monté, rien ne se passe.
 */
export function zaWarudo(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ZA_WARUDO_EVENT));
}
