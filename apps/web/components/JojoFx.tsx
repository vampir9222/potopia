"use client";

import { effectiveVolume } from "@app/ui";
import { useEffect } from "react";

/*
 * Effets interactifs du thème JoJo, actifs seulement quand ce thème est affiché. Sprites du jeu de
 * Capcom (public/jojo/*-strip.png) et voix (public/audio/jojo-*.mp3).
 * - Clic maintenu dans le vide : Star Platinum surgit et enchaîne « ORA ORA ORA ». Au bout de
 *   2,5 s, The World arrive en face : le choc ORA contre MUDA. Au bout de 6 s, DIO tombe du ciel
 *   sur son rouleau compresseur (« ROAD ROLLER DA ! ») et Star Platinum le martèle. Au relâchement,
 *   « ORA ! » final : le rouleau est renvoyé dans les airs.
 * - Clic sur Jotaro (en bas à droite) : « Yare yare daze ». Clic sur DIO : ゴゴゴゴ.
 * Tout passe par le DOM (pas d'état React par impact) dans une couche `.jojo-fx` posée au-dessus de
 * la page, sans clic. Rien pendant un arrêt du temps ; pas de secousse si l'appareil demande moins
 * d'animations. Monté une fois, layout racine.
 */

const HOLD_MS = 220; // en dessous, c'est un simple clic
const MOVE_TOLERANCE = 12; // au-delà, c'est une sélection ou un glisser
const CLASH_MS = 2500; // The World arrive
const ROLLER_MS = 6000; // le rouleau compresseur tombe
const WORD_EVERY_MS = 90;
const HINT_KEY = "potopia:jojo-hint-seen"; // bulle d'aide déjà vue sur cet appareil
// Éléments où un clic maintenu garde son sens habituel.
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, canvas, [role='button'], [contenteditable], [data-no-ora]";

const SOUNDS = {
  ora: "/audio/jojo-ora.mp3",
  muda: "/audio/jojo-muda.mp3",
  roller: "/audio/jojo-road-roller.mp3",
  yare: "/audio/jojo-yare-yare.mp3",
  menacing: "/audio/jojo-menacing.mp3",
} as const;

const isJojo = () =>
  document.documentElement.dataset.theme === "jojo" &&
  !document.documentElement.classList.contains("time-stop");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const within = (el: Element | null, x: number, y: number) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

function play(src: string, { loop = false, volume = 0.8 } = {}) {
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = Math.min(1, effectiveVolume() * volume);
  audio.play().catch(() => {});
  return audio;
}

export function JojoFx() {
  useEffect(() => {
    const layer = document.createElement("div");
    layer.className = "jojo-fx";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
    const timers = new Set<number>();
    const later = (ms: number, fn: () => void) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
      return t;
    };

    /** Ajoute un élément à la couche. */
    const spawn = (className: string, style: Partial<CSSStyleDeclaration> = {}, text = "") => {
      const el = document.createElement("span");
      el.className = className;
      el.textContent = text;
      Object.assign(el.style, style);
      layer.append(el);
      return el;
    };
    /** Pareil, retiré à la fin de son animation. */
    const transient = (className: string, style: Partial<CSSStyleDeclaration>, text = "") => {
      const el = spawn(className, style, text);
      el.addEventListener("animationend", () => el.remove(), { once: true });
      return el;
    };

    const shake = (power: number, ms: number) => {
      if (reducedMotion()) return;
      const frames = Array.from({ length: 8 }, (_, i) => ({
        transform:
          i === 7
            ? "none"
            : `translate(${rand(-power, power)}px, ${rand(-power, power)}px) rotate(${rand(-power, power) / 6}deg)`,
      }));
      // le temps de la secousse, rien ne dépasse sur les côtés (pas de barre de défilement)
      const root = document.documentElement;
      root.classList.add("jojo-shaking");
      const anim = document.querySelector("main")?.animate(frames, { duration: ms });
      anim?.addEventListener("finish", () => root.classList.remove("jojo-shaking"));
    };

    /** Mot de rafale (ORA, MUDA) qui claque près du point visé, avec un éclat d'impact. */
    const word = (x: number, y: number, text: string, color: string, spread: number) => {
      const dx = rand(-spread, spread);
      const dy = rand(-spread, spread);
      transient(
        "jojo-fx-word",
        {
          left: `${x + dx}px`,
          top: `${y + dy}px`,
          color,
          fontSize: `${rand(24, 50)}px`,
          rotate: `${rand(-28, 28)}deg`,
        },
        text,
      );
      transient("jojo-fx-impact", {
        left: `${x + dx * 0.4}px`,
        top: `${y + dy * 0.4}px`,
        width: `${rand(40, 90)}px`,
        rotate: `${rand(0, 90)}deg`,
      });
    };

    // ── Clic maintenu : la scène ──
    type Scene = {
      x: number;
      y: number;
      star: HTMLElement;
      world?: HTMLElement;
      roller?: HTMLElement;
      voices: HTMLAudioElement[];
      ticker: number;
    };
    let scene: Scene | null = null;
    let holdTimer = 0;
    let start = { x: 0, y: 0 };
    let point = { x: 0, y: 0 };

    const place = (s: Scene) => {
      for (const el of [s.star, s.world]) {
        if (!el) continue;
        el.style.left = `${s.x}px`;
        el.style.top = `${s.y}px`;
      }
      if (s.roller) s.roller.style.left = `${s.x}px`;
    };

    const begin = () => {
      document.documentElement.classList.add("jojo-rushing");
      window.getSelection()?.removeAllRanges();
      const s: Scene = {
        ...point,
        star: spawn("jojo-fx-sprite jojo-fx-star"),
        voices: [play(SOUNDS.ora, { loop: true })],
        ticker: 0,
      };
      scene = s;
      place(s);
      s.ticker = window.setInterval(() => {
        place(s);
        if (s.world) {
          word(s.x - 40, s.y, "ORA", "#f4c430", 70);
          word(s.x + 60, s.y, "MUDA", "#c78cff", 70);
        } else {
          word(s.x + 20, s.y, "ORA", "#f4c430", 90);
        }
        if (Math.random() < 0.35) shake(3, 110);
      }, WORD_EVERY_MS);

      // The World entre dans la danse : le choc des rafales
      later(CLASH_MS, () => {
        if (scene !== s) return;
        s.world = spawn("jojo-fx-sprite jojo-fx-world");
        s.voices.push(play(SOUNDS.muda, { loop: true }));
        transient("jojo-fx-ring", { left: `${s.x + 10}px`, top: `${s.y}px` });
        place(s);
      });

      // DIO tombe du ciel avec son rouleau compresseur
      later(ROLLER_MS, () => {
        if (scene !== s) return;
        s.world?.remove();
        s.world = undefined;
        s.voices.pop()?.pause();
        s.voices.push(play(SOUNDS.roller, { volume: 1 }));
        s.roller = spawn("jojo-fx-sprite jojo-fx-roller", { top: `${s.y}px` });
        place(s);
        transient("jojo-fx-shout", {}, "ROAD ROLLER DA !");
        later(520, () => {
          if (scene !== s) return;
          transient("jojo-fx-ring", { left: `${s.x}px`, top: `${s.y}px` });
          shake(22, 650);
        });
      });
    };

    const end = (final: boolean) => {
      window.clearTimeout(holdTimer);
      const s = scene;
      if (!s) return;
      scene = null;
      window.clearInterval(s.ticker);
      s.voices.forEach((v) => v.pause());
      document.documentElement.classList.remove("jojo-rushing");
      s.star.classList.add("jojo-fx-leave");
      s.star.addEventListener("animationend", () => s.star.remove(), { once: true });
      s.world?.remove();
      if (s.roller) {
        // « ORA ! » : le rouleau compresseur repart dans les airs
        const roller = s.roller;
        roller.classList.add("jojo-fx-roller-out");
        roller.addEventListener("animationend", () => roller.remove(), { once: true });
      }
      if (!final) return;
      transient("jojo-fx-final", { left: `${s.x}px`, top: `${s.y}px`, color: "#f4c430" }, "ORA !");
      transient("jojo-fx-ring", { left: `${s.x}px`, top: `${s.y}px` });
      transient("jojo-fx-don", { left: `${s.x + 70}px`, top: `${s.y - 80}px` }, "ドン");
      shake(14, 420);
    };

    // ── Les personnages du décor ──
    let talking = false;
    const bubble = (el: Element, text: string, extra = "") => {
      const r = el.getBoundingClientRect();
      // centrée sur le personnage, sans sortir de l'écran
      const left = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
      transient(`jojo-fx-bubble ${extra}`, { left: `${left}px`, top: `${r.top}px` }, text);
    };
    const yareYare = (el: Element) => {
      talking = true;
      play(SOUNDS.yare, { volume: 1 });
      bubble(el, "やれやれだぜ…");
      later(2200, () => (talking = false));
    };
    const menacing = (el: Element) => {
      talking = true;
      const r = el.getBoundingClientRect();
      play(SOUNDS.menacing, { volume: 1 });
      for (let i = 0; i < 6; i++) {
        later(i * 140, () =>
          transient("jojo-fx-gogo", {
            left: `${r.left + rand(-40, r.width + 40)}px`,
            top: `${r.top + rand(-30, r.height * 0.6)}px`,
            rotate: `${rand(-20, 20)}deg`,
          }),
        );
      }
      bubble(el, "WRYYYYY !", "jojo-fx-bubble-dio");
      later(2200, () => (talking = false));
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !isJojo()) return;
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      // les personnages du décor ne parlent que si on les voit : pas à travers une carte
      const visible = !(e.target instanceof Element && e.target.closest(".theme-frame"));
      const jotaro = document.querySelector(".jojo-pose");
      const dio = document.querySelector(".jojo-dio");
      if (visible && jotaro && within(jotaro, e.clientX, e.clientY)) {
        return talking || yareYare(jotaro);
      }
      if (visible && dio && within(dio, e.clientX, e.clientY)) return talking || menacing(dio);
      start = point = { x: e.clientX, y: e.clientY };
      holdTimer = window.setTimeout(begin, HOLD_MS);
    };
    const onMove = (e: PointerEvent) => {
      point = { x: e.clientX, y: e.clientY };
      if (scene) {
        scene.x = point.x;
        scene.y = point.y;
      } else if (Math.hypot(point.x - start.x, point.y - start.y) > MOVE_TOLERANCE) {
        window.clearTimeout(holdTimer);
      }
    };
    const onUp = () => end(true);
    const onCancel = () => end(false);
    // un appui long au doigt ouvrirait le menu contextuel en pleine rafale
    const onContext = (e: Event) => {
      if (scene) e.preventDefault();
    };

    // Bulle d'aide, une fois par appareil, la première fois que le thème est affiché.
    const showHint = () => {
      try {
        if (!isJojo() || window.localStorage.getItem(HINT_KEY)) return;
        window.localStorage.setItem(HINT_KEY, "1");
      } catch {
        return;
      }
      const hint = document.createElement("div");
      hint.className = "jojo-fx-hint";
      hint.innerHTML =
        "<strong>ゴゴゴゴ…</strong><span>Maintiens le clic dans le vide : <b>ORA ORA ORA</b> ! Tiens bon… DIO n'est jamais loin. Et clique sur Jotaro ou sur DIO, en bas à droite.</span>";
      const close = () => hint.remove();
      hint.addEventListener("click", close);
      document.body.append(hint);
      later(12000, close);
    };
    later(2500, showHint);

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    window.addEventListener("contextmenu", onContext);
    return () => {
      end(false);
      timers.forEach((t) => window.clearTimeout(t));
      document.querySelector(".jojo-fx-hint")?.remove();
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
      window.removeEventListener("contextmenu", onContext);
      layer.remove();
    };
  }, []);

  return null;
}
