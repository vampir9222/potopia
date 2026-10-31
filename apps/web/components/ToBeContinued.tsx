"use client";

import { cx, effectiveVolume, TO_BE_CONTINUED_EVENT } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Intro de Roundabout coupée pour l'occasion (public/audio/roundabout.mp3, ~9 s) : la montée du
// piano inversé culmine à 2,4 s, c'est là que l'image se fige.
const MUSIC = "/audio/roundabout.mp3";
const FREEZE_MS = 2400;
const END_MS = 9000;
const FADE_MS = 700;

type Phase = "off" | "music" | "frozen" | "leaving";

/**
 * « To Be Continued » (JoJo) après une défaite : la musique démarre, l'image se fige en sépia sur
 * le pic, la flèche glisse en bas à gauche, puis tout repart. Un clic ou Échap l'écourte.
 * Déclenché par `toBeContinued()` de `@app/ui` (TROIS, Agents Doubles). Monté une fois, dans le
 * layout racine.
 */
export function ToBeContinued() {
  const [phase, setPhase] = useState<Phase>("off");
  const phaseRef = useRef<Phase>("off");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timers = useRef<number[]>([]);
  const dismissRef = useRef<() => void>(() => {});

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
      audio.volume = effectiveVolume();
      audio.play().catch(() => {});
      audioRef.current = audio;
      go("music");
      later(FREEZE_MS, () => go("frozen"));
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
        className="tbc-arrow absolute bottom-6 left-4 block aspect-[874/184] w-[min(70vw,520px)] bg-[url(/jojo/to-be-continued.png)] bg-contain bg-no-repeat drop-shadow-xl"
      />
    </div>,
    document.body,
  );
}
