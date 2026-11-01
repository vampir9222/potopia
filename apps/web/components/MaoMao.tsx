"use client";

/* eslint-disable @next/next/no-img-element -- image détourée déjà optimisée (WebP), pas de next/image */
import {
  cx,
  effectiveVolume,
  MAO_MAO_EVENT,
  MAO_MAO_SOON_EVENT,
  type MaoMaoDetail,
  type MaoMood,
} from "@app/ui";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Mao Mao (Les Carnets de l'apothicaire) juge les essais ratés à TROIS. Au 3e raté de suite sur un
 * mot, un rouleau suspendu se déroule : son regard qui s'assombrit, main sur la bouche, un sceau
 * vermillon « 三連続 » (trois de suite) et une réplique ; à l'avant-dernier essai, son dégoût,
 * cachée derrière sa manche. Le mot enfin trouvé après au moins 3 ratés : elle surgit, détourée, du
 * coin de l'écran, avec un sourire narquois. Le rouleau est court et se ferme à la première touche
 * (on continue de taper). Déclenché par `maoMao()` de `@app/ui`. Monté une fois, layout racine.
 */

const MEDIA = {
  judge: { video: "/apothicaire/mao-judge.mp4", poster: "/apothicaire/mao-judge.jpg" },
  disgust: { video: "/apothicaire/mao-disgust.mp4", poster: "/apothicaire/mao-disgust.jpg" },
} as const;
const SMUG = "/apothicaire/mao-smug.webp";

// Répliques, piochées au hasard ; des clins d'œil à l'anime (poisons, fard au plomb, limaces).
const LINES: Record<Exclude<MaoMood, "smug">, string[]> = {
  judge: [
    "Mao Mao te regarde comme une limace.",
    "Trois ratés. Même au poison, on finit par s'habituer.",
    "Diagnostic : aucun antidote connu.",
    "Elle préférerait encore goûter un champignon inconnu.",
    "Trop de fard au plomb, sans doute.",
  ],
  disgust: [
    "Mao Mao ne veut même plus te regarder.",
    "Dernier essai. Elle prépare déjà la décoction amère.",
    "Même Jinshi n'insiste pas autant.",
    "Là, c'est un cas pour le médecin des cadavres.",
  ],
};
const SMUG_LINES = [
  "Enfin. Tu as trouvé l'antidote ?",
  "Hm. Il était temps.",
  "Pas mal… pour une limace.",
];

const NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
/** 3 → 三, 12 → 十二, 30 → 三十 (jusqu'à 99). */
function kanji(n: number): string {
  if (n < 10) return NUMERALS[n] ?? String(n);
  const tens = Math.floor(n / 10);
  return `${tens > 1 ? (NUMERALS[tens] ?? "") : ""}十${NUMERALS[n % 10] ?? ""}`;
}
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)] as T;

/**
 * Cordes pincées synthétisées (Karplus-Strong), façon guzheng : une petite phrase pentatonique.
 * Pas de fichier son ; au volume réglé dans l'app.
 */
function pluck(notes: number[], gap = 0.16) {
  const volume = effectiveVolume() * 0.35;
  if (volume <= 0) return;
  const ctx = new AudioContext();
  notes.forEach((freq, i) => {
    const length = Math.floor(ctx.sampleRate * 1.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const period = Math.round(ctx.sampleRate / freq);
    for (let s = 0; s < period; s++) data[s] = Math.random() * 2 - 1;
    for (let s = period; s < length; s++) {
      data[s] = 0.996 * 0.5 * ((data[s - period] ?? 0) + (data[s - period + 1] ?? 0));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start(ctx.currentTime + i * gap);
  });
  window.setTimeout(() => void ctx.close(), notes.length * gap * 1000 + 2000);
}
const TUNES: Record<MaoMood, number[]> = {
  judge: [659.3, 587.3, 493.9, 440], // mi, ré, si, la : qui descend, déçu
  disgust: [392, 370, 293.7], // sol, fa#, ré : plus bas, plus sombre
  smug: [587.3, 880], // ré, la : petit « hm ! »
};

type Scene = { mood: MaoMood; misses: number; line: string; key: number };
const SCROLL_MS = 4500;
const SMUG_MS = 4200;

export function MaoMao() {
  const [scene, setScene] = useState<Scene | null>(null);
  const timer = useRef(0);
  const preloaded = useRef(false);

  useEffect(() => {
    // une défaite de plus et elle juge : ses vidéos et l'image se chargent en fond
    const preload = () => {
      if (preloaded.current) return;
      preloaded.current = true;
      for (const src of [MEDIA.judge.poster, MEDIA.disgust.poster, SMUG]) new Image().src = src;
      for (const { video } of Object.values(MEDIA)) {
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.src = video;
      }
    };
    const onMood = (e: Event) => {
      const { mood, misses } = (e as CustomEvent<MaoMaoDetail>).detail;
      window.clearTimeout(timer.current);
      setScene({
        mood,
        misses,
        line: mood === "smug" ? pick(SMUG_LINES) : pick(LINES[mood]),
        key: Date.now(),
      });
      pluck(TUNES[mood]);
      timer.current = window.setTimeout(
        () => setScene(null),
        mood === "smug" ? SMUG_MS : SCROLL_MS,
      );
    };
    // n'importe quelle touche ferme le rouleau : on est en train de taper un mot
    const onKey = () => setScene((s) => (s && s.mood !== "smug" ? null : s));
    window.addEventListener(MAO_MAO_SOON_EVENT, preload);
    window.addEventListener(MAO_MAO_EVENT, onMood);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(MAO_MAO_SOON_EVENT, preload);
      window.removeEventListener(MAO_MAO_EVENT, onMood);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!scene) return null;

  if (scene.mood === "smug") {
    return createPortal(
      <div key={scene.key} className="mao-smug" role="status" aria-live="polite">
        <p className="mao-smug-bubble">{scene.line}</p>
        <img src={SMUG} alt="Mao Mao, sourire narquois" className="mao-smug-face" />
      </div>,
      document.body,
    );
  }

  const media = MEDIA[scene.mood];
  return createPortal(
    <div
      key={scene.key}
      className={cx("mao-layer", scene.mood === "disgust" && "mao-layer-disgust")}
      role="dialog"
      aria-label={`${scene.misses} essais ratés de suite. ${scene.line}`}
      onClick={() => setScene(null)}
    >
      <div className="mao-petals" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
      <div className="mao-scroll">
        <span className="mao-rod mao-rod-top" aria-hidden />
        {/* le papier se déroule (grille de 0fr à 1fr) et pousse la tringle du bas */}
        <div className="mao-unroll">
          <div className="mao-paper">
            <div className="mao-frame">
              <video
                src={media.video}
                poster={media.poster}
                autoPlay
                muted
                playsInline
                loop={scene.mood === "disgust"}
                className="mao-video"
              />
            </div>
            <p className="mao-line">{scene.line}</p>
            <span className="mao-seal" aria-hidden>
              {`${kanji(scene.misses)}連続`}
            </span>
          </div>
        </div>
        <span className="mao-rod mao-rod-bottom" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
