"use client";

import { useSyncExternalStore } from "react";
import { toBeContinued } from "./toBeContinued";

/** Événement écouté par Mao Mao (`apps/web/components/MaoMao`) ; `detail` : son humeur. */
export const MAO_MAO_EVENT = "app:mao-mao";
/** Une défaite de plus et Mao Mao juge : de quoi charger ses vidéos à l'avance. */
export const MAO_MAO_SOON_EVENT = "app:mao-mao-soon";

/**
 * Humeur de Mao Mao (Les Carnets de l'apothicaire) : son regard de jugement à 3 défaites
 * d'affilée, son dégoût à 6 (et à chaque nouvelle série de 3), son sourire narquois à la victoire
 * qui casse une série de 3 défaites ou plus.
 */
export type MaoMood = "judge" | "disgust" | "smug";
export type MaoMaoDetail = { mood: MaoMood; streak: number };

// Défaites d'affilée et réglage, gardés sur l'appareil (page Paramètres pour le réglage).
const STREAK_KEY = "potopia:defeat-streak";
const DISABLED_KEY = "potopia:mao-mao-disabled";
const CHANGE_EVENT = "potopia:mao-mao-setting";
const SERIES = 3;

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* navigation privée : la série repart de zéro au rechargement */
  }
};
const readDisabled = () => read(DISABLED_KEY) === "1";
const streak = () => Number(read(STREAK_KEY)) || 0;

function show(mood: MaoMood, count: number) {
  window.dispatchEvent(
    new CustomEvent<MaoMaoDetail>(MAO_MAO_EVENT, { detail: { mood, streak: count } }),
  );
}

/**
 * Une partie perdue (TROIS, Agents Doubles). D'habitude « To Be Continued » ; à la 3e défaite
 * d'affilée, Mao Mao juge à sa place (puis son dégoût à la 6e, la 9e…). Si le membre l'a coupée
 * dans ses paramètres, la série compte quand même, et « To Be Continued » reste.
 */
export function defeat(): void {
  if (typeof window === "undefined") return;
  const count = streak() + 1;
  write(STREAK_KEY, String(count));
  if (count % SERIES === SERIES - 1) window.dispatchEvent(new Event(MAO_MAO_SOON_EVENT));
  if (count % SERIES !== 0 || readDisabled()) return toBeContinued();
  show(count === SERIES ? "judge" : "disgust", count);
}

/** Une partie gagnée : la série s'arrête ; après 3 défaites ou plus, Mao Mao ricane. */
export function victory(): void {
  if (typeof window === "undefined") return;
  const count = streak();
  write(STREAK_KEY, null);
  if (count >= SERIES && !readDisabled()) show("smug", count);
}

export function setMaoMaoDisabled(disabled: boolean): void {
  write(DISABLED_KEY, disabled ? "1" : null);
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
