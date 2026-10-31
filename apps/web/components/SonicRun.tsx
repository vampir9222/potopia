"use client";

import { cx, effectiveVolume, onVolumeChange } from "@app/ui";
import { useEffect, useRef, useState } from "react";

/** Planche horizontale d'une animation : `frames` cases de `w` × `h` px (pixel art à l'échelle 1). */
type Sheet = { src: string; frames: number; w: number; h: number };

const SHEETS = {
  idle: { src: "/sonic/sonic-idle.png", frames: 4, w: 29, h: 42 },
  walk: { src: "/sonic/sonic-walk.png", frames: 12, w: 41, h: 40 },
  run: { src: "/sonic/sonic-run.png", frames: 4, w: 34, h: 40 },
  fast: { src: "/sonic/sonic-fast.png", frames: 4, w: 45, h: 40 },
  trans: { src: "/sonic/sonic-ss-trans.png", frames: 8, w: 38, h: 50 },
  ssRun: { src: "/sonic/sonic-ss-run.png", frames: 4, w: 35, h: 40 },
  ssFly: { src: "/sonic/sonic-ss-fly.png", frames: 2, w: 38, h: 35 },
} satisfies Record<string, Sheet>;
type SheetName = keyof typeof SHEETS;

const MUSIC = "/audio/sonic.mp3";
const SUPER_MUSIC = "/audio/super-sonic.mp3";
const WIDTH = 48;
// Le liseré du header occupe sa dernière ligne de pixels (header h-14 = 56 px) : les pieds dessus.
const LINE_Y = 55;
// Transformation en Super Sonic : durées du gif d'origine.
const TRANS_MS = [250, 250, 250, 250, 250, 250, 250, 500];
const SUPER_RUN_MS = 2200;

const STREAK_COLORS = {
  blue: "linear-gradient(to left, rgb(255 255 255 / 0.95), rgb(90 150 255 / 0.7) 35%, transparent)",
  gold: "linear-gradient(to left, rgb(255 250 210 / 1), rgb(255 200 40 / 0.8) 35%, transparent)",
};

type Mode = "idle" | "running" | "super";

/**
 * Sonic dans le header. À l'arrêt il attend en tapant du pied ; un clic lance sa musique : il
 * marche, prend de la vitesse, court, et pique de temps en temps un sprint, avec une traînée sur
 * le liseré. Second clic : retour au calme. Avec les 7 Émeraudes du Chaos (`superSonic`), le clic
 * le transforme en Super Sonic, qui sprinte puis s'envole.
 */
export function SonicRun({ superSonic }: { superSonic: boolean }) {
  const [mode, setMode] = useState<Mode>("idle");
  const spriteRef = useRef<HTMLSpanElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // La musique s'arrête quand on quitte la page, et suit le volume global du header.
  useEffect(() => () => audioRef.current?.pause(), []);
  useEffect(
    () =>
      onVolumeChange(() => {
        if (audioRef.current) audioRef.current.volume = effectiveVolume();
      }),
    [],
  );

  useEffect(() => {
    const sprite = spriteRef.current;
    const streak = streakRef.current;
    if (!sprite || !streak) return;
    let current: SheetName | null = null;
    const show = (name: SheetName, frame: number, lift = 0) => {
      const s = SHEETS[name];
      if (name !== current) {
        current = name;
        sprite.style.backgroundImage = `url(${s.src})`;
        sprite.style.backgroundSize = `${s.frames * s.w}px ${s.h}px`;
        sprite.style.width = `${s.w}px`;
        sprite.style.height = `${s.h}px`;
        sprite.style.left = `${Math.round((WIDTH - s.w) / 2)}px`;
      }
      sprite.style.top = `${LINE_Y - s.h - Math.round(lift)}px`;
      sprite.style.backgroundPosition = `${-(frame % s.frames) * s.w}px 0`;
    };
    const trail = (length: number, color: keyof typeof STREAK_COLORS) => {
      streak.style.width = `${Math.round(length)}px`;
      streak.style.opacity = length > 4 ? "1" : "0";
      streak.style.backgroundImage = STREAK_COLORS[color];
    };

    let raf = 0;
    const start = performance.now();
    // vitesse du sprint : un boost de temps en temps pendant la course
    let boostUntil = 0;
    let nextBoost = start + 3500;
    let frame = 0;
    let lastStep = start;

    const tick = (now: number) => {
      const t = now - start;
      if (mode === "idle") {
        // il attend : une longue pause, puis trois petits mouvements (le gif d'origine allait trop vite)
        const cycle = t % 2650;
        show("idle", cycle < 2200 ? 0 : 1 + Math.floor((cycle - 2200) / 150));
        trail(0, "blue");
      } else if (mode === "running") {
        if (now > nextBoost) {
          boostUntil = now + 1500 + Math.random() * 1200;
          nextBoost = boostUntil + 3500 + Math.random() * 3500;
        }
        const name: SheetName = t < 1600 ? "walk" : now < boostUntil ? "fast" : "run";
        // la marche accélère en démarrant
        const step = name === "walk" ? 95 - t / 40 : name === "fast" ? 40 : 60;
        if (now - lastStep >= step) {
          frame += 1;
          lastStep = now;
        }
        show(name, frame);
        trail(name === "walk" ? 0 : name === "run" ? 50 : 130 + 20 * Math.sin(now / 60), "blue");
      } else {
        const transTotal = TRANS_MS.reduce((a, b) => a + b, 0);
        if (t < transTotal) {
          let acc = 0;
          let i = 0;
          while (i < TRANS_MS.length - 1 && t >= acc + (TRANS_MS[i] ?? 0))
            acc += TRANS_MS[i++] ?? 0;
          show("trans", i);
          trail(0, "gold");
        } else if (t < transTotal + SUPER_RUN_MS) {
          show("ssRun", Math.floor(t / 50));
          trail(110 + 15 * Math.sin(now / 50), "gold");
        } else {
          // il décolle, puis flotte au-dessus du liseré
          const flight = t - transTotal - SUPER_RUN_MS;
          const lift = Math.min(9, flight / 40) + 2 * Math.sin(now / 300);
          show("ssFly", Math.floor(t / 70), lift);
          trail(190 + 25 * Math.sin(now / 45), "gold");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  function toggle() {
    audioRef.current?.pause();
    if (mode !== "idle") {
      setMode("idle");
      return;
    }
    const next: Mode = superSonic ? "super" : "running";
    const src = next === "super" ? SUPER_MUSIC : MUSIC;
    if (!audioRef.current?.src.endsWith(src)) {
      const audio = new Audio(src);
      audio.loop = true;
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.volume = effectiveVolume();
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    setMode(next);
  }

  const playing = mode !== "idle";
  return (
    <div className="relative hidden h-14 shrink-0 lg:block" style={{ width: WIDTH }}>
      {/* traînée de vitesse sur le liseré, derrière lui */}
      <span
        ref={streakRef}
        aria-hidden
        className="sonic-streak pointer-events-none absolute h-0.5 opacity-0 transition-opacity"
        style={{ right: WIDTH / 2, top: LINE_Y - 1 }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Arrêter Sonic" : superSonic ? "Lancer Super Sonic" : "Lancer Sonic"}
        aria-pressed={playing}
        title={playing ? "Pause" : superSonic ? "Super Sonic" : "Sonic"}
        className="absolute inset-0 rounded-md transition-[filter] hover:brightness-125"
      >
        <span
          ref={spriteRef}
          aria-hidden
          className={cx("absolute block", mode === "super" && "sonic-super")}
          style={{ imageRendering: "pixelated" }}
        />
      </button>
    </div>
  );
}
