"use client";

import { useSyncExternalStore } from "react";

/** Événement écouté par Mao Mao (`apps/web/components/MaoMao`) ; `detail` : son humeur. */
export const MAO_MAO_EVENT = "app:mao-mao";
/** Encore un essai raté et Mao Mao juge : de quoi charger ses vidéos à l'avance. */
export const MAO_MAO_SOON_EVENT = "app:mao-mao-soon";

/**
 * Humeur de Mao Mao (Les Carnets de l'apothicaire) : son regard de jugement au 3e essai raté de
 * suite sur un mot, son dégoût au 5e (le dernier essai approche), son sourire narquois quand le mot
 * est enfin trouvé après au moins 3 ratés.
 */
export type MaoMood = "judge" | "disgust" | "smug";
export type MaoMaoDetail = { mood: MaoMood; misses: number };

// Réglage gardé sur l'appareil (page Paramètres).
const DISABLED_KEY = "potopia:mao-mao-disabled";
const CHANGE_EVENT = "potopia:mao-mao-setting";

function readDisabled(): boolean {
  try {
    return window.localStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mao Mao réagit (TROIS) ; rien si le membre l'a coupée dans ses paramètres. */
export function maoMao(mood: MaoMood, misses: number): void {
  if (typeof window === "undefined" || readDisabled()) return;
  window.dispatchEvent(new CustomEvent<MaoMaoDetail>(MAO_MAO_EVENT, { detail: { mood, misses } }));
}

/** Prévient Mao Mao qu'elle va sans doute juger bientôt : elle charge ses vidéos. */
export function maoMaoSoon(): void {
  if (typeof window === "undefined" || readDisabled()) return;
  window.dispatchEvent(new Event(MAO_MAO_SOON_EVENT));
}

export function setMaoMaoDisabled(disabled: boolean): void {
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

/** Mao Mao est-elle coupée sur cet appareil ? */
export function useMaoMaoDisabled(): boolean {
  return useSyncExternalStore(subscribe, readDisabled, () => false);
}
