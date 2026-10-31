"use client";

import { useSyncExternalStore } from "react";
import type { MascotMood } from "./Mascot";

/**
 * Une page peut réserver une place à la mascotte flottante (`anchor`, un élément vide à sa taille) :
 * elle quitte alors son coin pour s'y poser, et prend l'humeur demandée (`mood`). Exemple : TROIS,
 * sous le podium, où elle réagit aux mots trouvés ou perdus.
 */
type Stage = { anchor: HTMLElement | null; mood: MascotMood | null };

let state: Stage = { anchor: null, mood: null };
const listeners = new Set<() => void>();

export function setMascotStage(patch: Partial<Stage>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const SERVER: Stage = { anchor: null, mood: null };

export function useMascotStage(): Stage {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER,
  );
}
