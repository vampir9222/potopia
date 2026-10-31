"use client";

import { useSyncExternalStore } from "react";
import type { MascotMood } from "./Mascot";

/**
 * Une page peut réserver une place à la mascotte flottante (`anchor`, un élément vide à sa taille) :
 * elle quitte alors son coin pour s'y poser, et prend l'humeur demandée (`mood`). `movable` : on
 * peut l'en décrocher en la faisant glisser (accueil) ; `chatty` : elle lance des phrases dans une
 * bulle (TROIS, sous le podium, où elle réagit aux mots trouvés ou perdus).
 */
type Stage = {
  anchor: HTMLElement | null;
  mood: MascotMood | null;
  movable: boolean;
  chatty: boolean;
};

const EMPTY: Stage = { anchor: null, mood: null, movable: false, chatty: false };
let state: Stage = EMPTY;
const listeners = new Set<() => void>();
const moodListeners = new Set<(mood: MascotMood | null) => void>();

/** Remet l'état de départ (la page qui réservait une place disparaît). */
export const MASCOT_STAGE_EMPTY = EMPTY;

export function setMascotStage(patch: Partial<Stage>): void {
  const before = state;
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
  if (before.mood !== state.mood) moodListeners.forEach((fn) => fn(state.mood));
}

/** Prévenu quand la page change l'humeur demandée (pour lancer une bulle…). */
export function onMascotMoodChange(fn: (mood: MascotMood | null) => void): () => void {
  moodListeners.add(fn);
  return () => {
    moodListeners.delete(fn);
  };
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useMascotStage(): Stage {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}
