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

/** Combo : la boule se charge dans sa case avant de partir, et tout s'efface en douceur à l'arrêt. */
export const COMBO_CHARGE_MS = 900;
export const COMBO_LEAVE_MS = 600;

/** Monte ou baisse le volume d'une musique en douceur, puis la coupe si on descend à 0. */
export function fadeAudio(audio: HTMLAudioElement | null, to: number, ms: number): void {
  if (!audio) return;
  const from = audio.volume;
  const t0 = performance.now();
  const step = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) return;
    window.clearInterval(step);
    if (to === 0) audio.pause();
  }, 40);
}
