"use client";

import { effectiveVolume, onVolumeChange } from "@app/ui";
import { useEffect, useRef } from "react";

const MUSIC = "/audio/one-piece.mp3";
// Luffy qui court (Gear 5) : 24 frames de 150 px dans le gif, affichées à 0,38 comme Luffy.
const RUN_FRAMES = 24;
const RUN_SIZE = 150 * 0.38;
const RUN_GROUND = 142 * 0.38;
// La steel ball : la planche de la boule, frame de repos, roulée par rotation CSS.
const BALL = 48;
const BALL_FRAMES = 48;
const BALL_REST = 8;
const LINE_Y = 55;
const SPEED = 190; // px/s
const GAP = 64; // distance entre Luffy et la boule
const HOP_MS = 360;

/**
 * Combo : la steel ball tourne et on clique sur le fruit. La boule quitte sa place et roule sur le
 * liseré (rotation = distance parcourue / rayon, dans le bon sens), Luffy sort du fruit quand
 * elle passe et lui court après ; au bout du header elle rebondit et c'est elle qui le poursuit,
 * et ainsi de suite, sur le générique de One Piece. Calque posé sur toute la largeur du header.
 */
export function LuffyCombo({
  offset,
  width,
  ballStart,
  luffyStart,
}: {
  /** Position de la case de Luffy dans le header (px depuis son bord gauche). */
  offset: number;
  width: number;
  /** Centres de départ (px depuis le bord gauche du header). */
  ballStart: number;
  luffyStart: number;
}) {
  const ballRef = useRef<HTMLSpanElement>(null);
  const luffyRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const audio = new Audio(MUSIC);
    audio.loop = true;
    audio.volume = effectiveVolume();
    audio.play().catch(() => {});
    const off = onVolumeChange(() => {
      audio.volume = effectiveVolume();
    });
    return () => {
      off();
      audio.pause();
    };
  }, []);

  useEffect(() => {
    const ball = ballRef.current;
    const luffy = luffyRef.current;
    if (!ball || !luffy) return;
    const minX = BALL / 2 + 8;
    // Luffy reste à droite de la boule : il faut la place pour lui avant le bord droit
    const maxX = width - GAP - RUN_SIZE / 2 - 12;
    let ballX = ballStart;
    let dir = -1;
    let angle = 0;
    let hopAt = -Infinity;
    let luffyX = luffyStart;
    let luffyOut = false;
    let facing = -1;
    let last = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ballX += dir * SPEED * dt;
      if (ballX <= minX || ballX >= maxX) {
        ballX = Math.min(maxX, Math.max(minX, ballX));
        dir = -dir;
        hopAt = now;
      }
      // rouler sans glisser : un tour de boule = son périmètre parcouru
      angle += ((dir * SPEED * dt) / (BALL / 2)) * (180 / Math.PI);
      const hop = now - hopAt < HOP_MS ? Math.sin((Math.PI * (now - hopAt)) / HOP_MS) * 10 : 0;
      ball.style.transform = `translate(${ballX - BALL / 2}px, ${LINE_Y - BALL - hop}px) rotate(${angle}deg)`;

      // Luffy sort du fruit quand la boule passe devant lui, puis la suit (ou la fuit) à droite
      if (!luffyOut && ballX < luffyStart - GAP) {
        luffyOut = true;
        luffy.style.opacity = "1";
        luffy.classList.add("luffy-pop");
      }
      if (luffyOut) {
        const target = ballX + GAP;
        const step = Math.max(-1, Math.min(1, (target - luffyX) / 6)) * SPEED * 1.4 * dt;
        luffyX += step;
        // il regarde là où il court (il suit la boule vers la gauche, la fuit vers la droite)
        if (Math.abs(step) > SPEED * dt * 0.3) facing = Math.sign(step);
        const frame = Math.floor(now / 50) % RUN_FRAMES;
        luffy.style.backgroundPosition = `${-frame * RUN_SIZE}px 0`;
        luffy.style.left = `${luffyX - RUN_SIZE / 2}px`;
        // `scale` et non `transform` : l'animation d'apparition (luffy-pop) occupe déjà transform
        luffy.style.scale = `${facing} 1`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, ballStart, luffyStart]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 z-40 h-14"
      style={{ left: -offset, width }}
    >
      <span
        ref={luffyRef}
        className="absolute block opacity-0"
        style={{
          top: LINE_Y - RUN_GROUND,
          width: RUN_SIZE,
          height: RUN_SIZE,
          transformOrigin: `50% ${(RUN_GROUND / RUN_SIZE) * 100}%`,
          backgroundImage: "url(/luffy/luffy-run-sheet.png)",
          backgroundSize: `${RUN_FRAMES * RUN_SIZE}px ${RUN_SIZE}px`,
        }}
      />
      <span
        ref={ballRef}
        className="orb-glow absolute top-0 left-0 block"
        style={{
          width: BALL,
          height: BALL,
          backgroundImage: "url(/orb/orb-sheet.png)",
          backgroundSize: `${BALL_FRAMES * BALL}px ${BALL}px`,
          backgroundPosition: `${-BALL_REST * BALL}px 0`,
          imageRendering: "pixelated",
          transform: `translate(${ballStart - BALL / 2}px, ${LINE_Y - BALL}px)`,
        }}
      />
    </div>
  );
}
