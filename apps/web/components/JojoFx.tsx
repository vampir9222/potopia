"use client";

import { effectiveVolume, ROAD_ROLLER_EVENT, toBeContinued } from "@app/ui";
import { useEffect } from "react";

/*
 * Effets interactifs du thème JoJo, actifs seulement quand ce thème est affiché. Sprites du jeu de
 * Capcom (public/jojo/*-strip.png), voix et thème de Jotaro (public/audio/jojo-*.mp3).
 * - Un clic sur la fiche de Stand (`data-stand-toggle`) invoque Star Platinum, qui flotte alors
 *   autour de la souris (gardé sur l'appareil). Re-clic : il est rappelé.
 * - Stand invoqué, clic maintenu dans le vide : rafale « ORA ORA ORA » sur le thème de Jotaro ; la
 *   case de la page que frappent les poings tremble. Rafale près de DIO (en bas de l'écran) : il
 *   sort The World, qui répond en « MUDA MUDA ».
 * - Secret : pendant l'arrêt du temps (ZA WARUDO), un clic sur DIO, et il lâche son rouleau
 *   compresseur quand le temps reprend. Il faut alors le repousser en rafale, sinon… To Be
 *   Continued.
 * - Clic sur Jotaro (en bas à droite) : « Yare yare daze ». Clic sur DIO : ゴゴゴゴ.
 * Tout passe par le DOM (pas d'état React par impact) dans une couche `.jojo-fx` posée au-dessus de
 * la page, sans clic. Rien pendant un arrêt du temps ; pas de secousse si l'appareil demande moins
 * d'animations. Monté une fois, layout racine.
 */

const HOLD_MS = 200; // en dessous, c'est un simple clic
const MOVE_TOLERANCE = 12; // au-delà, c'est une sélection ou un glisser
const HIT_EVERY_MS = 85;
const DIO_RANGE = 260; // distance à laquelle DIO sort The World
const ROLLER_ESCAPE_MS = 4500; // temps pour commencer à repousser le rouleau
const ROLLER_PUSH_MS = 1800; // durée de rafale qui le renvoie
const ROLLER_RETRY_MS = 2500; // rafale trop courte : temps avant qu'il retombe
const STAND_KEY = "potopia:jojo-stand"; // Stand invoqué, gardé sur l'appareil
const HINT_KEY = "potopia:jojo-hint-seen"; // bulle d'aide déjà vue sur cet appareil
// Éléments où un clic maintenu garde son sens habituel.
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, canvas, [role='button'], [contenteditable], [data-no-ora]";

const SOUNDS = {
  ora: "/audio/jojo-ora.mp3",
  theme: "/audio/jojo-theme-jotaro.mp3",
  muda: "/audio/jojo-muda.mp3",
  roller: "/audio/jojo-road-roller.mp3",
  yare: "/audio/jojo-yare-yare.mp3",
  menacing: "/audio/jojo-menacing.mp3",
} as const;

const root = () => document.documentElement;
const isJojo = () => root().dataset.theme === "jojo" && !root().classList.contains("time-stop");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const within = (el: Element | null, x: number, y: number) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};
const readStand = () => {
  try {
    return window.localStorage.getItem(STAND_KEY) === "1";
  } catch {
    return false;
  }
};

function play(src: string, { loop = false, volume = 0.8 } = {}) {
  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = Math.min(1, effectiveVolume() * volume);
  audio.play().catch(() => {});
  return audio;
}
/** Baisse le son jusqu'au silence, puis l'arrête. */
function fadeOut(audio: HTMLAudioElement, ms: number) {
  const from = audio.volume;
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    audio.volume = from * (1 - k);
    if (k < 1) requestAnimationFrame(step);
    else audio.pause();
  };
  requestAnimationFrame(step);
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

    /** Fait trembler `el` (la case frappée, ou toute la page). */
    const shake = (el: Element | null, power: number, ms: number) => {
      if (!el || reducedMotion()) return;
      const frames = Array.from({ length: 6 }, (_, i) => ({
        transform:
          i === 5
            ? "none"
            : `translate(${rand(-power, power)}px, ${rand(-power, power)}px) rotate(${rand(-power, power) / 8}deg)`,
      }));
      root().classList.add("jojo-shaking");
      el.animate(frames, { duration: ms, composite: "add" }).addEventListener("finish", () =>
        root().classList.remove("jojo-shaking"),
      );
    };
    /** La case de la page sous le point (x, y) : là où frappent les poings. */
    const struck = (x: number, y: number) => {
      const el = document
        .elementsFromPoint(x, y)
        .find((e) => !e.closest(".jojo-fx, .jojo-decor, .jojo-fx-hint"));
      return el?.closest(".theme-frame") ?? el?.closest("main") ?? null;
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

    // ── Le Stand qui flotte autour de la souris ──
    type Rush = {
      star: HTMLElement;
      world?: HTMLElement;
      ora: HTMLAudioElement;
      theme: HTMLAudioElement;
      muda?: HTMLAudioElement;
      ticker: number;
      startedAt: number;
    };
    let rush: Rush | null = null;
    let roller: { el: HTMLElement; escape: number } | null = null;
    let standOn = false;
    let floater: HTMLElement | null = null;
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let pos = { ...mouse };
    let facing = 1; // 1 : regarde à droite, -1 : à gauche
    let frame = 0;

    const follow = () => {
      if (floater && !rush) {
        // derrière la souris, un peu au-dessus, côté opposé au regard ; il rattrape en douceur
        pos.x += (mouse.x - 70 * facing - pos.x) * 0.12;
        pos.y += (mouse.y - 50 - pos.y) * 0.12;
        floater.style.left = `${pos.x}px`;
        floater.style.top = `${pos.y}px`;
        floater.style.scale = `${facing} 1`;
      }
      frame = requestAnimationFrame(follow);
    };

    const setStand = (on: boolean, { announce = true } = {}) => {
      standOn = on && isJojo();
      root().classList.toggle("jojo-stand-on", standOn);
      try {
        window.localStorage.setItem(STAND_KEY, standOn ? "1" : "0");
      } catch {
        /* navigation privée : le Stand ne survivra pas au rechargement */
      }
      if (standOn && !floater) {
        pos = { x: mouse.x - 70, y: mouse.y - 50 };
        floater = spawn("jojo-fx-sprite jojo-fx-floater");
        if (announce) {
          play(SOUNDS.menacing, { volume: 0.7 });
          transient("jojo-fx-ring", { left: `${mouse.x}px`, top: `${mouse.y}px` });
        }
      }
      if (!standOn && floater) {
        const f = floater;
        floater = null;
        f.classList.add("jojo-fx-leave");
        f.addEventListener("animationend", () => f.remove(), { once: true });
      }
    };

    // ── La rafale ──
    let holdTimer = 0;
    let start = { x: 0, y: 0 };

    const placeRush = (r: Rush) => {
      r.star.style.left = `${mouse.x}px`;
      r.star.style.top = `${mouse.y}px`;
      r.star.style.scale = `${facing} 1`;
      r.star.classList.toggle("jojo-fx-star-left", facing < 0);
    };

    const beginRush = () => {
      if (!standOn || !isJojo()) return;
      root().classList.add("jojo-rushing");
      window.getSelection()?.removeAllRanges();
      floater?.classList.add("jojo-fx-hidden");
      const r: Rush = {
        star: spawn("jojo-fx-sprite jojo-fx-star"),
        ora: play(SOUNDS.ora, { loop: true }),
        theme: play(SOUNDS.theme, { loop: true, volume: 0.6 }),
        ticker: 0,
        startedAt: performance.now(),
      };
      rush = r;
      placeRush(r);
      r.ticker = window.setInterval(() => {
        placeRush(r);
        const { x, y } = mouse;
        // DIO à portée : il sort The World, tourné vers Star Platinum
        const dio = document.querySelector(".jojo-dio");
        const d = dio ? center(dio) : null;
        const near = !!d && Math.hypot(d.x - x, d.y - y) < DIO_RANGE;
        if (near && d && !r.world) {
          r.world = spawn("jojo-fx-sprite jojo-fx-world");
          r.muda = play(SOUNDS.muda, { loop: true });
          transient("jojo-fx-ring", { left: `${d.x}px`, top: `${d.y}px` });
        }
        if (!near && r.world) {
          r.world.remove();
          r.world = undefined;
          r.muda?.pause();
          r.muda = undefined;
        }
        if (r.world && d) {
          const toLeft = x < d.x;
          r.world.style.left = `${d.x + (toLeft ? -30 : 30)}px`;
          r.world.style.top = `${d.y - 20}px`;
          r.world.style.scale = `${toLeft ? -1 : 1} 1`;
          r.world.classList.toggle("jojo-fx-world-left", toLeft);
          word((x + d.x) / 2, y, "MUDA", "#c78cff", 60);
        }
        word(x, y, "ORA", "#f4c430", r.world ? 60 : 80);
        shake(struck(x, y), 5, 120);
        if (roller) shake(roller.el, 6, 120);
      }, HIT_EVERY_MS);
    };

    const launchRoller = () => {
      if (!roller) return;
      window.clearTimeout(roller.escape);
      const el = roller.el;
      roller = null;
      el.classList.add("jojo-fx-roller-out");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    };

    const endRush = (final: boolean) => {
      window.clearTimeout(holdTimer);
      const r = rush;
      if (!r) return;
      rush = null;
      window.clearInterval(r.ticker);
      r.ora.pause();
      r.muda?.pause();
      fadeOut(r.theme, 1500);
      root().classList.remove("jojo-rushing");
      r.star.remove();
      r.world?.remove();
      floater?.classList.remove("jojo-fx-hidden");
      if (!final) return;
      const { x, y } = mouse;
      transient("jojo-fx-final", { left: `${x}px`, top: `${y}px`, color: "#f4c430" }, "ORA !");
      transient("jojo-fx-ring", { left: `${x}px`, top: `${y}px` });
      transient("jojo-fx-don", { left: `${x + 70}px`, top: `${y - 80}px` }, "ドン");
      shake(struck(x, y), 16, 420);
      // le rouleau : renvoyé après une rafale assez longue, sinon il retombe bientôt
      if (roller && performance.now() - r.startedAt >= ROLLER_PUSH_MS) launchRoller();
      else if (roller) {
        window.clearTimeout(roller.escape);
        roller.escape = later(ROLLER_RETRY_MS, crush);
      }
    };

    // ── Secret : le rouleau compresseur de DIO ──
    /** Pas de rafale à temps : écrasé. */
    const crush = () => {
      if (!roller || rush) return;
      roller.el.remove();
      roller = null;
      transient("jojo-fx-flash", {});
      toBeContinued();
    };
    const roadRoller = () => {
      // il tombe quand le temps reprend
      if (root().classList.contains("time-stop")) return void later(150, roadRoller);
      if (!isJojo() || roller) return;
      if (!standOn) setStand(true, { announce: false });
      play(SOUNDS.roller, { volume: 1 });
      const el = spawn("jojo-fx-sprite jojo-fx-roller", {
        left: `${mouse.x}px`,
        top: `${mouse.y}px`,
      });
      transient("jojo-fx-shout", {}, "ROAD ROLLER DA !");
      later(520, () => {
        transient("jojo-fx-ring", { left: `${mouse.x}px`, top: `${mouse.y}px` });
        shake(document.querySelector("main"), 22, 650);
      });
      roller = { el, escape: later(ROLLER_ESCAPE_MS, crush) };
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

    // ── Écouteurs ──
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !isJojo()) return;
      // sous le rouleau compresseur, on peut riposter n'importe où
      if (!roller && e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      // les personnages du décor ne parlent que si on les voit : pas à travers une carte
      const visible = !(e.target instanceof Element && e.target.closest(".theme-frame"));
      const jotaro = document.querySelector(".jojo-pose");
      const dio = document.querySelector(".jojo-dio");
      if (visible && !standOn && jotaro && within(jotaro, e.clientX, e.clientY)) {
        return talking || yareYare(jotaro);
      }
      if (visible && !standOn && dio && within(dio, e.clientX, e.clientY)) {
        return talking || menacing(dio);
      }
      if (!standOn) return;
      start = { x: e.clientX, y: e.clientY };
      holdTimer = window.setTimeout(beginRush, HOLD_MS);
    };
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - mouse.x;
      if (Math.abs(dx) > 2) facing = dx > 0 ? 1 : -1;
      mouse = { x: e.clientX, y: e.clientY };
      if (!rush && Math.hypot(mouse.x - start.x, mouse.y - start.y) > MOVE_TOLERANCE) {
        window.clearTimeout(holdTimer);
      }
    };
    const onUp = () => endRush(true);
    const onCancel = () => endRush(false);
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-stand-toggle]")) return;
      if (isJojo()) setStand(!standOn);
    };
    // un appui long au doigt ouvrirait le menu contextuel en pleine rafale
    const onContext = (e: Event) => {
      if (rush) e.preventDefault();
    };
    // le thème change sans recharger : on range le Stand hors du thème JoJo
    const themeWatch = new MutationObserver(() => {
      if (root().dataset.theme !== "jojo" && standOn) {
        endRush(false);
        setStand(false, { announce: false });
      }
    });
    themeWatch.observe(root(), { attributes: true, attributeFilter: ["data-theme"] });

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
        "<strong>ゴゴゴゴ…</strong><span>Clique sur ta <b>fiche de Stand</b> pour l'invoquer, puis maintiens le clic : <b>ORA ORA ORA</b> ! Va donc chercher DIO, en bas de l'écran… Et quand il arrête le temps, garde un œil sur lui.</span>";
      const close = () => hint.remove();
      hint.addEventListener("click", close);
      document.body.append(hint);
      later(14000, close);
    };
    later(2500, showHint);
    if (readStand()) setStand(true, { announce: false });
    frame = requestAnimationFrame(follow);

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    window.addEventListener("click", onClick);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener(ROAD_ROLLER_EVENT, roadRoller);
    return () => {
      endRush(false);
      cancelAnimationFrame(frame);
      themeWatch.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      document.querySelector(".jojo-fx-hint")?.remove();
      root().classList.remove("jojo-stand-on");
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
      window.removeEventListener("click", onClick);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener(ROAD_ROLLER_EVENT, roadRoller);
      layer.remove();
    };
  }, []);

  return null;
}
