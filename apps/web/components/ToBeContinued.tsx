"use client";

import { cx, effectiveVolume, preloadImages, TO_BE_CONTINUED_EVENT } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Roundabout découpé à la main (public/audio/roundabout.mp3, 6,4 s) : il part directement sur le
// passage de la guitare, l'image se fige dès la défaite. Discret, avec un petit fondu sur la fin.
const MUSIC = "/audio/roundabout.mp3";
const ARROW = "/jojo/to-be-continued.webp"; // la même image que la classe de fond de la flèche
const VOLUME = 0.45;
const END_MS = 6300;
const FADE_MS = 900;

type Phase = "off" | "frozen" | "leaving";

/**
 * « To Be Continued » (JoJo) après une défaite : dès la défaite, l'image se fige en sépia, la
 * flèche glisse en bas à gauche sur Roundabout, puis tout repart dans un fondu. Un clic ou Échap
 * l'écourte. Déclenché par `toBeContinued()` de `@app/ui` (TROIS, Agents Doubles), qui ne fait rien
 * si le membre a coupé l'effet dans ses paramètres. Monté une fois, dans le layout racine.
 */
export function ToBeContinued() {
  const [phase, setPhase] = useState<Phase>("off");
  const phaseRef = useRef<Phase>("off");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timers = useRef<number[]>([]);
  const dismissRef = useRef<() => void>(() => {});

  // la flèche est chargée d'avance : elle doit tomber pile avec la musique
  useEffect(() => void preloadImages([ARROW]), []);

  useEffect(() => {
    const go = (next: Phase) => {
      phaseRef.current = next;
      setPhase(next);
      document.documentElement.classList.toggle("tbc-freeze", next === "frozen");
    };
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

    const stop = () => {
      clear();
      go("leaving");
      const audio = audioRef.current;
      const from = audio?.volume ?? 0;
      const t0 = performance.now();
      const fade = window.setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / FADE_MS);
        if (audio) audio.volume = from * (1 - k);
        if (k >= 1) {
          window.clearInterval(fade);
          audio?.pause();
          go("off");
        }
      }, 40);
    };

    const start = () => {
      if (phaseRef.current !== "off") return;
      const audio = new Audio(MUSIC);
      audio.volume = effectiveVolume() * VOLUME;
      audio.play().catch(() => {});
      audioRef.current = audio;
      go("frozen");
      later(END_MS - FADE_MS, stop);
    };

    dismissRef.current = () => {
      if (phaseRef.current === "frozen") stop();
    };
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRef.current();
    };

    window.addEventListener(TO_BE_CONTINUED_EVENT, start);
    window.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener(TO_BE_CONTINUED_EVENT, start);
      window.removeEventListener("keydown", dismiss);
      clear();
      audioRef.current?.pause();
      document.documentElement.classList.remove("tbc-freeze");
    };
  }, []);

  if (phase !== "frozen" && phase !== "leaving") return null;
  return createPortal(
    <div
      className={cx("tbc-layer fixed inset-0 z-100", phase === "leaving" && "tbc-leaving")}
      onClick={() => dismissRef.current()}
    >
      <span
        role="img"
        aria-label="To Be Continued"
        className="tbc-arrow absolute bottom-6 left-4 block aspect-[874/184] w-[min(70vw,520px)] bg-[url(/jojo/to-be-continued.webp)] bg-contain bg-no-repeat drop-shadow-xl"
      />
    </div>,
    document.body,
  );
}
