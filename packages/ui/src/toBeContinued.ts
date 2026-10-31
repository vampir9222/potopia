"use client";

import { useSyncExternalStore } from "react";

/** Événement écouté par l'overlay « To Be Continued » de l'app (`apps/web/components/ToBeContinued`). */
export const TO_BE_CONTINUED_EVENT = "app:to-be-continued";

// Réglage gardé sur l'appareil (page Paramètres) : l'effet peut être coupé pour de bon.
const DISABLED_KEY = "potopia:to-be-continued-disabled";
const CHANGE_EVENT = "potopia:to-be-continued-setting";

function readDisabled(): boolean {
  try {
    return window.localStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Défaite : l'écran se fige en sépia sur Roundabout, et la flèche « To Be Continued » glisse en bas
 * à gauche (JoJo). Les jeux l'appellent ; sans overlay monté, ou si le membre a coupé l'effet
 * dans ses paramètres, rien ne se passe.
 */
export function toBeContinued(): void {
  if (typeof window === "undefined" || readDisabled()) return;
  window.dispatchEvent(new Event(TO_BE_CONTINUED_EVENT));
}

export function setToBeContinuedDisabled(disabled: boolean): void {
  try {
    if (disabled) window.localStorage.setItem(DISABLED_KEY, "1");
    else window.localStorage.removeItem(DISABLED_KEY);
  } catch {
    /* navigation privée : le réglage ne survivra pas au rechargement */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(fn: () => void) {
  window.addEventListener(CHANGE_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(CHANGE_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** L'effet « To Be Continued » est-il coupé sur cet appareil ? */
export function useToBeContinuedDisabled(): boolean {
  return useSyncExternalStore(subscribe, readDisabled, () => false);
}
