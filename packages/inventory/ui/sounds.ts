"use client";

import { effectiveVolume } from "@app/ui";

/**
 * Joue un court bruitage (découpé dans les sons de Sonic 2), à une fraction du volume du site, avec
 * un fondu sur la fin pour qu'il ne s'arrête pas net.
 */
export function playClip(src: string, volume: number, fadeOutMs = 400): void {
  const audio = new Audio(src);
  const level = effectiveVolume() * volume;
  audio.volume = level;
  audio.addEventListener("loadedmetadata", () => {
    const fadeAt = Math.max(0, audio.duration * 1000 - fadeOutMs);
    window.setTimeout(() => {
      const t0 = performance.now();
      const step = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / fadeOutMs);
        audio.volume = level * (1 - k);
        if (k >= 1) window.clearInterval(step);
      }, 40);
    }, fadeAt);
  });
  audio.play().catch(() => {});
}

// Volumes volontairement discrets : ces sons passent par-dessus les musiques du header.
export const SOUNDS = {
  pickup: { src: "/audio/emerald.mp3", volume: 0.35 },
  unseal: { src: "/audio/emeralds-unseal.mp3", volume: 0.4 },
  seal: { src: "/audio/emeralds-seal.mp3", volume: 0.4 },
} as const;
