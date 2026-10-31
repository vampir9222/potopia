"use client";

import { useSyncExternalStore } from "react";

/**
 * État partagé entre les jouets du header, pour les combos : la boule tourne-t-elle (`orbPlaying`),
 * et le combo « Luffy court après la steel ball » est-il lancé (`combo`).
 */
type Stage = { orbPlaying: boolean; combo: boolean };

let state: Stage = { orbPlaying: false, combo: false };
const listeners = new Set<() => void>();
const comboListeners = new Set<(combo: boolean) => void>();

export function setStage(patch: Partial<Stage>): void {
  const before = state;
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
  if (before.combo !== state.combo) comboListeners.forEach((fn) => fn(state.combo));
}

/** Prévenu quand le combo démarre ou s'arrête (pour couper une musique, ranger un sprite…). */
export function onComboChange(fn: (combo: boolean) => void): () => void {
  comboListeners.add(fn);
  return () => {
    comboListeners.delete(fn);
  };
}

export const getStage = (): Stage => state;

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const SERVER: Stage = { orbPlaying: false, combo: false };

export function useHeaderStage(): Stage {
  return useSyncExternalStore(subscribe, getStage, () => SERVER);
}
