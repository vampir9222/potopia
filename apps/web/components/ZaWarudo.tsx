"use client";

import {
  cx,
  effectiveVolume,
  resumeTime,
  ROAD_ROLLER_EVENT,
  stopTime,
  trackMedia,
  ZA_WARUDO_EVENT,
} from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// « ZA WARUDO ! Toki wo tomare ! » (~4,5 s) puis la reprise du temps (~1,8 s, pic à 0,8 s).
const STOP_SOUND = "/audio/za-warudo.mp3";
const RESUME_SOUND = "/audio/time-resume.mp3";
const WAVE_MS = 950; // l'onde s'étend puis se referme ; le temps est arrêté à la fin
const RESUME_HIT_MS = 800;
const OUT_MS = 500;
const VOLUME = 0.8;

type Phase = "off" | "wave" | "stopped" | "resume";

/**
 * Arrêt du temps façon DIO (thème JoJo). Le cri part, une onde inverse les couleurs depuis le
 * centre, puis la page se fige dans une teinte délavée, « 時よ止まれ ! » : animations CSS et
 * transitions, animations Web (`element.animate`), animations JS qui lisent `timeNow()`, sons.
 * Le temps reste arrêté jusqu'à un clic (ou Échap) : il reprend alors, dans une onde inverse.
 * Déclenché par `zaWarudo()` de `@app/ui` (choix du thème JoJo, ou nouveau clic dessus). Monté une
 * fois, layout racine.
 */
export function ZaWarudo() {
  const [phase, setPhase] = useState<Phase>("off");
  const phaseRef = useRef<Phase>("off");
  const timers = useRef<number[]>([]);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    trackMedia();
    // animations Web et transitions en cours hors de l'effet (émeraudes…) : mises en pause,
    // relancées à la reprise. Les animations CSS, elles, sont figées par la classe time-stop (les
    // piloter ici leur ferait ignorer animation-play-state ensuite).
    let frozen: Animation[] = [];
    const go = (next: Phase) => {
      phaseRef.current = next;
      setPhase(next);
      document.documentElement.classList.toggle("time-stop", next === "stopped");
      // tout le reste se fige (animations du header, musiques) pendant l'effet, et repart à la fin
      if (next === "wave" || next === "stopped") stopTime();
      if (next === "stopped") {
        frozen = document.getAnimations().filter((a) => {
          const target = (a.effect as KeyframeEffect | null)?.target;
          return (
            a.playState === "running" &&
            !(a instanceof CSSAnimation) &&
            !target?.closest(".za-layer")
          );
        });
        frozen.forEach((a) => a.pause());
      }
      if (next === "resume") {
        frozen.forEach((a) => a.play());
        frozen = [];
      }
      if (next === "off") resumeTime();
    };
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const play = (src: string) => {
      const audio = new Audio(src);
      // la voix de DIO n'est pas figée par son propre arrêt du temps
      audio.dataset.timeStopProof = "1";
      audio.volume = effectiveVolume() * VOLUME;
      audio.play().catch(() => {});
      return audio;
    };
    let voice: HTMLAudioElement | null = null;

    // le temps reprend : son de reprise, onde inverse sur son pic, puis tout redevient normal
    const resume = () => {
      clear();
      voice?.pause();
      play(RESUME_SOUND);
      later(RESUME_HIT_MS, () => go("resume"));
      later(RESUME_HIT_MS + OUT_MS, () => go("off"));
    };

    const start = () => {
      if (phaseRef.current !== "off") return;
      voice = play(STOP_SOUND);
      go("wave");
      // puis le temps reste arrêté, jusqu'à ce qu'on clique
      later(WAVE_MS, () => go("stopped"));
    };

    skipRef.current = () => {
      if (phaseRef.current === "stopped") resume();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipRef.current();
    };

    window.addEventListener(ZA_WARUDO_EVENT, start);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(ZA_WARUDO_EVENT, start);
      window.removeEventListener("keydown", onKey);
      clear();
      voice?.pause();
      document.documentElement.classList.remove("time-stop");
      resumeTime();
    };
  }, []);

  if (phase === "off") return null;
  return createPortal(
    <div
      className={cx("za-layer fixed inset-0 z-100", phase === "stopped" && "cursor-pointer")}
      onClick={(e) => {
        // secret du thème JoJo : un clic sur DIO pendant l'arrêt du temps, et il lâche son
        // rouleau compresseur au moment où le temps reprend (JojoFx)
        const dio = document.querySelector(".jojo-dio")?.getBoundingClientRect();
        const onDio =
          phase === "stopped" &&
          dio &&
          e.clientX >= dio.left &&
          e.clientX <= dio.right &&
          e.clientY >= dio.top &&
          e.clientY <= dio.bottom;
        skipRef.current();
        if (onDio) window.dispatchEvent(new Event(ROAD_ROLLER_EVENT));
      }}
    >
      {(phase === "wave" || phase === "resume") && (
        <span className={cx("za-wave", phase === "resume" && "za-wave-out")} />
      )}
      {phase === "wave" && <span className="za-shout">ZA WARUDO !</span>}
      {phase === "stopped" && (
        <>
          <span className="za-stopped">時よ止まれ！</span>
          <span className="za-hint">Clic : le temps reprend</span>
        </>
      )}
    </div>,
    document.body,
  );
}
