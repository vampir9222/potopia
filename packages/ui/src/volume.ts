"use client";

import { useSyncExternalStore } from "react";

/**
 * Volume global du site (bouton du header), mémorisé sur l'appareil. Tout son joué sur le site
 * doit le respecter : `effectiveVolume()` donne le volume à appliquer (0 à 1), `onVolumeChange()`
 * prévient quand il change.
 */
export type VolumeState = { level: number; muted: boolean };

const KEY = "volume";
const DEFAULT: VolumeState = { level: 0.8, muted: false };
let state: VolumeState | null = null;
const listeners = new Set<() => void>();

function load(): VolumeState {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      saved &&
      typeof saved === "object" &&
      "level" in saved &&
      "muted" in saved &&
      typeof saved.level === "number" &&
      typeof saved.muted === "boolean"
    ) {
      return { level: Math.min(1, Math.max(0, saved.level)), muted: saved.muted };
    }
  } catch {
    /* stockage indisponible ou valeur illisible */
  }
  return DEFAULT;
}

export function getVolume(): VolumeState {
  if (typeof window === "undefined") return DEFAULT;
  state ??= load();
  return state;
}

export function setVolume(next: Partial<VolumeState>) {
  state = { ...getVolume(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

/** Volume à appliquer réellement : 0 quand le son est coupé. */
export function effectiveVolume(s: VolumeState = getVolume()) {
  return s.muted ? 0 : s.level;
}

export function onVolumeChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVolume() {
  return useSyncExternalStore(onVolumeChange, getVolume, () => DEFAULT);
}
