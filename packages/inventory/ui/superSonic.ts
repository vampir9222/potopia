"use client";

import { useSyncExternalStore } from "react";

// Réglages de Super Sonic, gardés sur l'appareil : les émeraudes peuvent être mises de côté (Sonic
// de base), et une fois transformé, Super Sonic le reste (son attente devient celle de Super Sonic).
const DISABLED_KEY = "potopia:super-sonic-disabled";
const TRANSFORMED_KEY = "potopia:super-sonic-transformed";
const EVENT = "potopia:super-sonic";

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* navigation privée : le réglage ne survivra pas au rechargement */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** Les émeraudes sont-elles mises de côté (Sonic de base même avec les 7) ? */
export function useEmeraldsDisabled(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read(DISABLED_KEY),
    () => false,
  );
}

export function setEmeraldsDisabled(disabled: boolean): void {
  write(DISABLED_KEY, disabled);
  // retour à Sonic de base : la prochaine fois, la transformation se rejoue
  if (disabled) write(TRANSFORMED_KEY, false);
}

/** Super Sonic s'est-il déjà transformé ? (son attente et sa course sautent alors la transformation) */
export function useSuperSonicTransformed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read(TRANSFORMED_KEY),
    () => false,
  );
}

export function setSuperSonicTransformed(): void {
  write(TRANSFORMED_KEY, true);
}
