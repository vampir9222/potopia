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

// Petit « tink » de cristal quand on tape sur une émeraude de l'inventaire. Synthétisé, et jamais
// deux fois le même : la note change à chaque coup (gamme pentatonique, jamais la même deux fois de
// suite, donc ça sonne toujours juste), légèrement désaccordée, avec des harmoniques plus ou moins
// présentes. Comme les coups de pioche d'un jeu de minage.
const TINK_NOTES = [1318.5, 1480, 1661.2, 1975.5, 2217.5]; // mi, fa#, sol#, si, do# (6e octave)
const TINK_VOLUME = 0.22;
let tinkContext: AudioContext | null = null;
let lastNote = -1;

export function playTink(): void {
  const level = effectiveVolume() * TINK_VOLUME;
  if (level <= 0) return;
  tinkContext ??= new AudioContext();
  const ctx = tinkContext;
  if (ctx.state === "suspended") void ctx.resume();
  let note = Math.floor(Math.random() * TINK_NOTES.length);
  if (note === lastNote) note = (note + 1 + Math.floor(Math.random() * 3)) % TINK_NOTES.length;
  lastNote = note;
  const base = (TINK_NOTES[note] ?? 1318.5) * (1 + (Math.random() - 0.5) * 0.015);
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = level * (0.8 + Math.random() * 0.3);
  out.connect(ctx.destination);
  // partiels inharmoniques d'un cristal, chacun avec sa durée : le grave tient, l'aigu claque
  const partials: [ratio: number, amp: number, decay: number][] = [
    [1, 1, 0.32 + Math.random() * 0.12],
    [2.76, 0.25 + Math.random() * 0.25, 0.12],
    [5.4, 0.08 + Math.random() * 0.15, 0.05],
  ];
  for (const [ratio, amp, decay] of partials) {
    const osc = ctx.createOscillator();
    osc.frequency.value = base * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(amp, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }
}

// Volumes volontairement discrets : ces sons passent par-dessus les musiques du header.
export const SOUNDS = {
  pickup: { src: "/audio/emerald.mp3", volume: 0.35 },
  unseal: { src: "/audio/emeralds-unseal.mp3", volume: 0.4 },
  seal: { src: "/audio/emeralds-seal.mp3", volume: 0.4 },
} as const;
