"use client";

import { cx, effectiveVolume, onVolumeChange } from "@app/ui";
import { useEffect, useRef } from "react";
import { COMBO_CHARGE_MS, COMBO_LEAVE_MS, fadeAudio } from "./headerStage";

const MUSIC = "/audio/one-piece.mp3";
// Luffy qui court (Gear 5) : 24 frames de 150 px dans le gif, affichées à 0,38 comme Luffy.
const RUN_FRAMES = 24;
const RUN_SIZE = 150 * 0.38;
const RUN_GROUND = 142 * 0.38;
// La steel ball : la planche de la boule, frame de repos, roulée par rotation CSS.
const BALL = 46; // même taille que dans sa case (SpinOrb)
const BALL_FRAMES = 48;
const BALL_REST = 8;
const LINE_Y = 55;
const SPEED = 190; // px/s
const GAP = 64; // distance entre Luffy et la boule
const HOP_MS = 360;
// Aux bords : la boule freine sur les derniers px, s'écrase, repart en accélérant ; Luffy fait
// demi-tour en sautant.
const BRAKE_PX = 90;
const ACCEL_MS = 500;
const SQUASH_MS = 220;
const TURN_MS = 380;
// Luffy sort du fruit (l'animation d'apparition a son propre délai) et court sur place avant de
// s'élancer ; la boule part après lui (COMBO_CHARGE_MS + LEAP_MS).
const LUFFY_SHOW_MS = 120;
const LUFFY_GO_MS = 800;
// Déroulé : la boule se charge dans sa case (COMBO_CHARGE_MS, voir SpinOrb), en jaillit dans un
// éclair, retombe sur le liseré et part en roulant ; la musique arrive ensuite, en fondu.
const LEAP_MS = 520;
const LEAP_HEIGHT = 22;
const MUSIC_DELAY_MS = COMBO_CHARGE_MS + 600;
const MUSIC_FADE_MS = 700; // léger fondu d'entrée sur le générique (version recoupée)

/**
 * Combo : la steel ball tourne et on clique sur le fruit. La boule se charge, jaillit de sa case et
 * roule sur le liseré (rotation = distance parcourue / rayon, dans le bon sens). Luffy sort du
 * fruit et file devant elle vers la gauche ; au bord, elle freine, s'écrase et rebondit, Luffy
 * fait demi-tour en sautant et c'est lui qui la poursuit, et ainsi de suite, sur le générique de
 * One Piece. À l'arrêt (`leaving`), tout s'efface
 * et la musique baisse. Calque posé sur toute la largeur du header.
 */
export function LuffyCombo({
  offset,
  width,
  ballStart,
  luffyStart,
  leaving,
}: {
  /** Position de la case de Luffy dans le header (px depuis son bord gauche). */
  offset: number;
  width: number;
  /** Centres de départ (px depuis le bord gauche du header). */
  ballStart: number;
  luffyStart: number;
  leaving: boolean;
}) {
  const widthRef = useRef(width);
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  const ballRef = useRef<HTMLSpanElement>(null);
  const spinRef = useRef<HTMLSpanElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const luffyRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // musique en fondu, une fois la boule partie
  useEffect(() => {
    const audio = new Audio(MUSIC);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    const start = window.setTimeout(() => {
      audio.play().catch(() => {});
      fadeAudio(audio, effectiveVolume(), MUSIC_FADE_MS);
    }, MUSIC_DELAY_MS);
    const off = onVolumeChange(() => {
      audio.volume = effectiveVolume();
    });
    return () => {
      window.clearTimeout(start);
      off();
      audio.pause();
    };
  }, []);

  useEffect(() => {
    if (leaving) fadeAudio(audioRef.current, 0, COMBO_LEAVE_MS);
  }, [leaving]);

  useEffect(() => {
    const ball = ballRef.current;
    const spin = spinRef.current;
    const luffy = luffyRef.current;
    const layer = layerRef.current;
    if (!ball || !spin || !luffy || !layer) return;
    // Luffy court devant, à gauche de la boule : il lui faut la place avant le bord gauche
    const minX = GAP + RUN_SIZE / 2 + 12;
    const luffyMin = minX - GAP;
    // largeur lue à chaque frame : un redimensionnement ne relance pas le combo
    const maxX = () => widthRef.current - BALL / 2 - 8;
    const t0 = performance.now();
    let ballX = ballStart;
    let dir = -1;
    let angle = 0;
    let bounceAt = -Infinity;
    let luffyX = luffyStart;
    let luffyOut = false;
    let facing = -1;
    let turnAt = -Infinity;
    let last = t0;
    let raf = 0;
    const smooth = (k: number) => k * k * (3 - 2 * k);

    // petit nuage de poussière contre le bord
    const dust = (x: number) => {
      const puff = document.createElement("span");
      puff.className = "combo-dust absolute block rounded-full";
      puff.style.left = `${x - 12}px`;
      puff.style.top = `${LINE_Y - 14}px`;
      puff.addEventListener("animationend", () => puff.remove());
      layer.appendChild(puff);
    };

    // Luffy : d'abord sur place, puis il file à gauche jusqu'au bord, se retourne et attend la
    // boule ; ensuite il reste à sa gauche (la fuit vers la gauche, la poursuit vers la droite).
    const runLuffy = (now: number, t: number, dt: number) => {
      const first = bounceAt === -Infinity;
      let step = 0;
      let wanted = facing;
      if (t < LUFFY_GO_MS) {
        wanted = -1;
      } else if (first) {
        step = Math.max(luffyMin - luffyX, -SPEED * dt);
        // arrivé au bord avant elle : il se retourne pour la voir arriver
        wanted = luffyX <= luffyMin + 1 ? 1 : -1;
      } else {
        step = Math.max(-1, Math.min(1, (ballX - GAP - luffyX) / 8)) * SPEED * 1.4 * dt;
        if (Math.abs(step) > SPEED * dt * 0.3) wanted = Math.sign(step);
      }
      luffyX += step;
      // demi-tour : un petit saut, il se retourne en l'air
      if (wanted !== facing && now - turnAt > TURN_MS) turnAt = now;
      const turning = now - turnAt;
      if (turning < TURN_MS && turning > TURN_MS / 2) facing = wanted;
      const hop = turning < TURN_MS ? Math.sin((Math.PI * turning) / TURN_MS) * 12 : 0;
      const frame = Math.floor(now / 50) % RUN_FRAMES;
      luffy.style.backgroundPosition = `${-frame * RUN_SIZE}px 0`;
      luffy.style.left = `${luffyX - RUN_SIZE / 2}px`;
      // `scale` et `translate` plutôt que `transform` : l'apparition (luffy-pop) occupe transform
      luffy.style.scale = `${facing} 1`;
      luffy.style.translate = `0 ${-hop}px`;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now - t0;

      // Luffy sort du fruit et se met à courir sur place, dans sa case, puis s'élance
      if (!luffyOut && t >= LUFFY_SHOW_MS) {
        luffyOut = true;
        luffy.style.opacity = "1";
        luffy.classList.add("luffy-pop");
      }
      if (luffyOut) runLuffy(now, t, dt);
      if (t < COMBO_CHARGE_MS) {
        // la boule se charge encore dans sa case (SpinOrb)
        raf = requestAnimationFrame(tick);
        return;
      }

      let y = LINE_Y - BALL;
      let squash = 0;
      if (t < COMBO_CHARGE_MS + LEAP_MS) {
        // elle jaillit de sa case et retombe sur le liseré, en tournant déjà
        const k = (t - COMBO_CHARGE_MS) / LEAP_MS;
        y -= Math.sin(Math.PI * k) * LEAP_HEIGHT;
        ball.style.opacity = "1";
        angle -= 540 * dt;
      } else {
        // freine en arrivant au bord, repart en accélérant après le rebond
        const toWall = dir < 0 ? ballX - minX : maxX() - ballX;
        const brake = 0.25 + 0.75 * smooth(Math.min(1, toWall / BRAKE_PX));
        const accel = 0.25 + 0.75 * smooth(Math.min(1, (now - bounceAt) / ACCEL_MS));
        const v = SPEED * Math.min(brake, accel);
        ballX += dir * v * dt;
        if (ballX <= minX || ballX >= maxX()) {
          ballX = Math.min(maxX(), Math.max(minX, ballX));
          dust(dir < 0 ? ballX - BALL / 2 : ballX + BALL / 2);
          dir = -dir;
          bounceAt = now;
        }
        // rouler sans glisser : un tour de boule = son périmètre parcouru
        angle += ((dir * v * dt) / (BALL / 2)) * (180 / Math.PI);
        const since = now - bounceAt;
        if (since < SQUASH_MS) squash = Math.sin((Math.PI * since) / SQUASH_MS);
        if (since < HOP_MS) y -= Math.sin((Math.PI * since) / HOP_MS) * 8;
      }
      // écrasée contre le bord : plus étroite, un peu plus haute, collée au sol
      const sx = 1 - 0.2 * squash;
      const sy = 1 + 0.1 * squash;
      ball.style.transform = `translate(${ballX - BALL / 2}px, ${y}px) scale(${sx}, ${sy})`;
      spin.style.transform = `rotate(${angle}deg)`;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // ballStart et luffyStart sont fixés au lancement du combo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden
      className={cx(
        // overflow-x-clip : rien ne dépasse à droite (sinon la page gagne une barre de défilement)
        "pointer-events-none absolute top-0 z-40 h-14 overflow-x-clip transition-opacity",
        leaving && "opacity-0",
      )}
      style={{ left: -offset, width, transitionDuration: `${COMBO_LEAVE_MS}ms` }}
    >
      {/* éclair quand la boule jaillit de sa case */}
      <span
        className="combo-burst absolute block rounded-full"
        style={{
          left: ballStart - BALL / 2,
          top: LINE_Y - BALL - 4,
          width: BALL,
          height: BALL,
          animationDelay: `${COMBO_CHARGE_MS}ms`,
        }}
      />
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
      {/* la boule : position et écrasement dehors, rotation dedans (l'écrasement ne tourne pas) */}
      <span
        ref={ballRef}
        className="orb-glow absolute top-0 left-0 block opacity-0"
        style={{
          width: BALL,
          height: BALL,
          transformOrigin: "50% 100%",
          transform: `translate(${ballStart - BALL / 2}px, ${LINE_Y - BALL}px)`,
        }}
      >
        <span
          ref={spinRef}
          className="absolute inset-0 block"
          style={{
            backgroundImage: "url(/orb/orb-sheet.png)",
            backgroundSize: `${BALL_FRAMES * BALL}px ${BALL}px`,
            backgroundPosition: `${-BALL_REST * BALL}px 0`,
            imageRendering: "pixelated",
          }}
        />
      </span>
    </div>
  );
}
