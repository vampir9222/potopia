/** Événement écouté par l'effet « ZA WARUDO » de l'app (`apps/web/components/ZaWarudo`). */
export const ZA_WARUDO_EVENT = "app:za-warudo";

/**
 * Événement du rouleau compresseur de DIO (secret du thème JoJo) : un clic sur DIO pendant que le
 * temps est arrêté le déclenche, écouté par les effets JoJo de l'app (`apps/web/components/JojoFx`).
 */
export const ROAD_ROLLER_EVENT = "app:road-roller";

/**
 * Arrêt du temps façon DIO : onde qui inverse les couleurs, page figée dans une teinte délavée,
 * puis le temps reprend. Déclenché en passant au thème JoJo ; sans effet monté, rien ne se passe.
 */
export function zaWarudo(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ZA_WARUDO_EVENT));
}
