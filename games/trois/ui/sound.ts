"use client";

import { effectiveVolume, onVolumeChange } from "@app/ui";
import { useSyncExternalStore } from "react";
import type { Mark } from "../src/game";

// Sons synthétisés avec Web Audio : aucun fichier à charger, rien dans le bundle.

const KEY = "trois_muted";
let ctx: AudioContext | null = null;
let master: AudioNode | null = null;
let volume: GainNode | null = null;
let muted = false;
const listeners = new Set<() => void>();

try {
  muted = typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
} catch {
  /* stockage indisponible */
}

/** Contexte audio + sortie commune (un compresseur évite la saturation quand les accords s'empilent). */
function audio() {
  if (muted || typeof window === "undefined") return null;
  // le contexte ne peut démarrer qu'après un geste de l'utilisateur : on le crée au premier son
  if (!ctx || !master) {
    ctx = new AudioContext();
    master = ctx.createDynamicsCompressor();
    // volume global du site (bouton du header), appliqué en toute fin de chaîne
    volume = ctx.createGain();
    volume.gain.value = effectiveVolume();
    master.connect(volume).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { a: ctx, out: master };
}

onVolumeChange(() => {
  if (ctx && volume) volume.gain.setTargetAtTime(effectiveVolume(), ctx.currentTime, 0.02);
});

type Tone = {
  freq: number;
  to?: number;
  at?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
};

function tone({ freq, to, at = 0, dur = 0.1, type = "sine", vol = 0.15 }: Tone) {
  const au = audio();
  if (!au) return;
  const { a, out } = au;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Note de cuivre : deux dents de scie désaccordées, filtre qui s'ouvre à l'attaque, vibrato sur les notes tenues. */
function brass(freq: number, at: number, dur: number, vol = 0.1) {
  const au = audio();
  if (!au) return;
  const { a, out } = au;
  const t = a.currentTime + at;
  const end = t + dur;

  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 1;
  filter.frequency.setValueAtTime(freq * 1.5, t);
  filter.frequency.exponentialRampToValueAtTime(freq * 6, t + 0.05);
  filter.frequency.exponentialRampToValueAtTime(freq * 3, t + 0.25);

  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.15);
  gain.gain.setValueAtTime(vol * 0.7, Math.max(t + 0.15, end - 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  filter.connect(gain).connect(out);

  for (const detune of [-7, 7]) {
    const osc = a.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = detune;
    if (dur > 0.4) {
      const lfo = a.createOscillator();
      const depth = a.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(12, t + 0.35);
      lfo.connect(depth).connect(osc.detune);
      lfo.start(t);
      lfo.stop(end + 0.02);
    }
    osc.connect(filter);
    osc.start(t);
    osc.stop(end + 0.02);
  }
}

/** Coup de timbale : sinus grave qui chute. */
const timpani = (freq: number, at: number) =>
  tone({ freq: freq * 1.5, to: freq, at, dur: 0.5, vol: 0.35 });

const notes = (freqs: number[], step: number, o: Omit<Tone, "freq" | "at"> = {}) =>
  freqs.forEach((freq, i) => tone({ freq, at: i * step, ...o }));

// ─── Mode Boobzilla : sons absurdes ───────────────────────────────────────────

let chaos = false;
let noise: AudioBuffer | null = null;
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

function whiteNoise(a: AudioContext) {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  return src;
}

/** Enveloppe simple : attaque, maintien, chute. */
function env(a: AudioContext, t: number, dur: number, vol: number) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

export const silly = {
  /** prout : dent de scie grave qui papillote + souffle filtré */
  fart(at = 0) {
    const au = audio();
    if (!au) return;
    const { a, out } = au;
    const t = a.currentTime + at;
    const dur = rnd(0.3, 1.1);
    const base = rnd(55, 110);

    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = rnd(350, 700);
    filter.Q.value = 6;
    const g = env(a, t, dur, 0.35);
    filter.connect(g).connect(out);

    const osc = a.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * rnd(0.6, 1.3), t + dur);
    // papillotement : l'amplitude est hachée 20 à 40 fois par seconde
    const flutter = a.createGain();
    flutter.gain.value = 0.5;
    const lfo = a.createOscillator();
    lfo.type = "square";
    lfo.frequency.setValueAtTime(rnd(18, 40), t);
    lfo.frequency.linearRampToValueAtTime(rnd(8, 25), t + dur);
    const depth = a.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(flutter.gain);
    osc.connect(flutter).connect(filter);

    const n = whiteNoise(a);
    const ng = a.createGain();
    ng.gain.value = 0.15;
    n.connect(ng).connect(filter);

    for (const s of [osc, lfo, n]) {
      s.start(t);
      s.stop(t + dur + 0.05);
    }
  },

  /** rugissement de kaiju : dents de scie saturées qui montent puis plongent */
  roar(at = 0) {
    const au = audio();
    if (!au) return;
    const { a, out } = au;
    const t = a.currentTime + at;
    const dur = 1.6;
    const shaper = a.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 512 - 1) * 6);
    shaper.curve = curve;
    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(2200, t + 0.4);
    filter.frequency.linearRampToValueAtTime(400, t + dur);
    const g = env(a, t, dur, 0.18);
    shaper.connect(filter).connect(g).connect(out);
    for (const detune of [-25, 0, 30]) {
      const o = a.createOscillator();
      o.type = "sawtooth";
      o.detune.value = detune;
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.45);
      o.frequency.exponentialRampToValueAtTime(45, t + dur);
      o.connect(shaper);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const n = whiteNoise(a);
    const ng = a.createGain();
    ng.gain.value = 0.3;
    n.connect(ng).connect(shaper);
    n.start(t);
    n.stop(t + dur + 0.05);
  },

  /** boing de ressort */
  boing(at = 0) {
    const au = audio();
    if (!au) return;
    const { a, out } = au;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(rnd(500, 800), t + 0.06);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
    const lfo = a.createOscillator();
    const depth = a.createGain();
    lfo.frequency.value = 14;
    depth.gain.value = 40;
    lfo.connect(depth).connect(o.frequency);
    o.connect(env(a, t, 0.5, 0.2)).connect(out);
    for (const s of [o, lfo]) {
      s.start(t);
      s.stop(t + 0.55);
    }
  },

  /** corne de brume de stade : BWAA BWAA BWAAAAA */
  airhorn(at = 0) {
    [0, 0.22, 0.44].forEach((d, i) => {
      const len = i === 2 ? 0.7 : 0.16;
      for (const f of [466, 470, 587])
        tone({ freq: f, to: f * 0.97, at: at + d, dur: len, type: "sawtooth", vol: 0.07 });
    });
  },

  /** canard en plastique */
  squeak(at = 0) {
    tone({ freq: rnd(900, 1400), to: rnd(1800, 2600), at, dur: 0.12, vol: 0.12 });
  },

  /** coin-coin */
  quack(at = 0) {
    const au = audio();
    if (!au) return;
    const { a, out } = au;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(rnd(500, 650), t);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.18);
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 4;
    o.connect(bp)
      .connect(env(a, t, 0.18, 0.4))
      .connect(out);
    o.start(t);
    o.stop(t + 0.2);
  },

  /** sifflet à coulisse, vers le haut ou vers le bas */
  slide(at = 0) {
    const up = Math.random() < 0.5;
    tone({ freq: up ? 400 : 1800, to: up ? 1800 : 300, at, dur: 0.6, vol: 0.12 });
  },

  /** pouet pouet triste (sortie du mode) */
  sadTrombone() {
    (
      [
        [311, 0.35],
        [294, 0.35],
        [277, 0.35],
        [262, 1.1],
      ] as const
    ).reduce<number>((at, [f, d]) => {
      brass(f, at, d, 0.1);
      return at + d;
    }, 0);
  },

  /** un son absurde au hasard */
  random(at = 0) {
    const all = [
      silly.fart,
      silly.boing,
      silly.squeak,
      silly.quack,
      silly.slide,
      silly.fart,
      silly.boing,
    ];
    (all[(Math.random() * all.length) | 0] ?? silly.fart)(at);
  },
};

/** En mode Boobzilla, les petits sons de l'interface deviennent absurdes. */
export function setChaos(on: boolean) {
  chaos = on;
}

let music: ReturnType<typeof setInterval> | null = null;

/** Boucle chiptune débile tant que le mode est actif. */
export function startMusic() {
  stopMusic();
  const bass = [65.41, 65.41, 77.78, 87.31, 65.41, 98, 87.31, 77.78];
  const lead = [523, 659, 784, 1047, 784, 659, 622, 784, 523, 659, 784, 932, 880, 784, 659, 587];
  let i = 0;
  music = setInterval(() => {
    tone({
      freq: (bass[(i >> 1) % bass.length] ?? 65.41) * 2,
      dur: 0.12,
      type: "square",
      vol: 0.05,
    });
    if (i % 2 === 0)
      tone({ freq: lead[(i >> 1) % lead.length] ?? 523, dur: 0.1, type: "square", vol: 0.025 });
    if (i % 4 === 0) tone({ freq: 120, to: 40, dur: 0.12, vol: 0.2 }); // grosse caisse
    i++;
  }, 140);
}

export function stopMusic() {
  if (music) clearInterval(music);
  music = null;
}

// fréquences (Hz)
const C3 = 130.81,
  G3 = 196,
  C4 = 261.63,
  E4 = 329.63,
  G4 = 392,
  C5 = 523.25,
  D5 = 587.33,
  E5 = 659.25,
  G5 = 783.99,
  C6 = 1046.5;

export const sfx = {
  key: () => (chaos ? silly.random() : tone({ freq: 520, dur: 0.04, type: "triangle", vol: 0.08 })),
  back: () => (chaos ? silly.fart() : tone({ freq: 340, dur: 0.05, type: "triangle", vol: 0.08 })),
  click: () => (chaos ? silly.boing() : tone({ freq: 760, dur: 0.05, vol: 0.06 })),
  error: () =>
    chaos ? silly.airhorn() : tone({ freq: 180, to: 110, dur: 0.18, type: "square", vol: 0.05 }),
  /** une case qui se retourne, au moment où elle se retourne */
  tile: (mark: Mark, at: number) =>
    mark === "correct"
      ? tone({ freq: 880, at, dur: 0.12, type: "triangle", vol: 0.12 })
      : mark === "present"
        ? tone({ freq: 620, at, dur: 0.1, type: "triangle", vol: 0.1 })
        : tone({ freq: 200, at, dur: 0.08, vol: 0.12 }),
  /** un mot trouvé : petite envolée de cuivres */
  win: () => {
    [C5, E5, G5].forEach((f, i) => brass(f, i * 0.09, 0.1, 0.08));
    brass(C6, 0.27, 0.45, 0.09);
    [C4, E4, G4].forEach((f) => brass(f, 0.27, 0.45, 0.04));
    timpani(C3, 0.27);
  },
  lose: () => notes([392, 330, 262], 0.16, { dur: 0.25, type: "sine", vol: 0.12 }),
  /** 3 sur 3 : fanfare de victoire (composition originale, triolets puis note tenue) */
  perfect: () => {
    const step = 0.12;
    const phrase = (at: number, pickup: number[], held: number, dur: number) => {
      pickup.forEach((f, i) => brass(f, at + i * step, step * 0.8, 0.08));
      const down = at + pickup.length * step;
      brass(held, down, dur, 0.1);
      return down;
    };
    const d1 = phrase(0, [G4, G4, G4], C5, 0.48);
    [C4, E4].forEach((f) => brass(f, d1, 0.48, 0.04));
    timpani(C3, d1);
    const d2 = phrase(d1 + 0.54, [E5, D5, E5], G5, 1.1);
    [C4, E4, G4].forEach((f) => brass(f, d2, 1.1, 0.045));
    brass(G3, d2, 1.1, 0.05);
    timpani(C3, d2);
    timpani(G3, d2 + 0.36);
  },
  success: () => notes([660, 990], 0.08, { dur: 0.12, vol: 0.1 }),
};

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? "1" : "0");
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => muted,
    () => false,
  );
}
