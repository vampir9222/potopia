"use client";

import { effectiveVolume, ROAD_ROLLER_EVENT, toBeContinued } from "@app/ui";
import { useEffect } from "react";

/*
 * Effets interactifs du thème JoJo, actifs seulement quand ce thème est affiché. Sprites du jeu de
 * Capcom (public/jojo/*-strip.png), voix et thème de Jotaro (public/audio/jojo-*.mp3).
 * - Le bouton « STAND » de la fiche (`data-stand-toggle`) invoque Star Platinum, qui flotte alors
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
const ROLLER_PUSH_MS = 5000; // rafale sous le rouleau qui le renvoie dans les airs
const ROLLER_RETRY_MS = 2500; // rafale trop courte : temps avant qu'il retombe
const RUSH_MAX_MS = 30000; // sécurité : une rafale s'arrête d'elle-même
const STAND_KEY = "potopia:jojo-stand"; // Stand invoqué, gardé sur l'appareil
const HINT_KEY = "potopia:jojo-hint-seen"; // bulle d'aide déjà vue sur cet appareil
// Éléments où un clic maintenu garde son sens habituel.
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, canvas, [role='button'], [contenteditable], [data-no-ora]";

const SOUNDS = {
  stand: "/audio/jojo-stand.mp3",
  standOut: "/audio/jojo-stand-out.mp3",
  ora: "/audio/jojo-ora.mp3",
  theme: "/audio/jojo-theme-jotaro.mp3",
  muda: "/audio/jojo-muda.mp3",
  roller: "/audio/jojo-road-roller.mp3",
  yare: "/audio/jojo-yare-yare.mp3",
  menacing: "/audio/jojo-menacing.mp3",
} as const;

// Sprites du thème, préchargés et décodés dès que le thème est affiché : rien ne se télécharge au
// moment d'un effet.
const SPRITES = [
  "/jojo/star-platinum-idle-strip.png",
  "/jojo/star-platinum-ora-strip.png",
  "/jojo/the-world-muda-strip.png",
  "/jojo/dio-road-roller-grid.png",
  "/jojo/menacing-gogo-strip.png",
];

const root = () => document.documentElement;
const isJojo = () => root().dataset.theme === "jojo" && !root().classList.contains("time-stop");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
/** Le point (x, y) est-il dans la boîte de `el`, élargie de `pad` pixels de chaque côté ? */
const within = (el: Element | null, x: number, y: number, pad = 0) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
};
// hitbox large autour des personnages du décor : tout le corps, et un peu plus
const CHARACTER_PAD = 24;
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

    /*
     * Tremblement purement visuel : on secoue le contenu d'une case, jamais la case ni une zone qui
     * défile (sa barre bougerait avec elle) ; dans une zone qui défile, c'est son contenu qui
     * tremble. Rien ne change de taille ni de place pour la page : les barres de défilement restent
     * immobiles.
     */
    const shaken = new WeakMap<Element, Element[]>();
    const contents = (el: Element): Element[] => {
      const known = shaken.get(el);
      if (known) return known;
      const parts = [...el.children].flatMap((child) => {
        const { overflowX, overflowY } = getComputedStyle(child);
        return /auto|scroll/.test(overflowX + overflowY) ? contents(child) : [child];
      });
      shaken.set(el, parts);
      return parts;
    };
    const jolt = (targets: Element[], power: number, ms: number) => {
      if (reducedMotion()) return;
      const frames = Array.from({ length: 6 }, (_, i) => ({
        transform:
          i === 5
            ? "none"
            : `translate(${rand(-power, power)}px, ${rand(-power, power)}px) rotate(${rand(-power, power) / 8}deg)`,
      }));
      for (const t of targets) t.animate(frames, { duration: ms, composite: "add" });
    };
    /** Fait trembler le contenu de la case frappée (rien hors d'une case). */
    const shake = (card: Element | null, power: number, ms: number) => {
      if (card) jolt(contents(card), power, ms);
    };
    /** Gros impact (rouleau compresseur) : c'est le décor du fond qui tremble, pas la page. */
    const quake = (power: number, ms: number) =>
      jolt([...document.querySelectorAll(".jojo-decor, .jojo-fx")], power, ms);
    /** La case de la page sous le point (x, y) : là où frappent les poings. */
    const struck = (x: number, y: number) =>
      document
        .elementsFromPoint(x, y)
        .find((e) => !e.closest(".jojo-fx, .jojo-decor, .jojo-fx-hint"))
        ?.closest(".theme-frame") ?? null;

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
      /** Début de la rafale sous le rouleau compresseur. */
      pushedSince?: number;
    };
    let rush: Rush | null = null;
    let roller: { el: HTMLElement; escape: number } | null = null;
    let standOn = false;
    let floater: HTMLElement | null = null;
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let pos = { ...mouse };
    let frame = 0;

    const follow = () => {
      if (floater && !rush) {
        // tourné vers la gauche, à droite de la souris et un peu au-dessus ; il rattrape en douceur
        pos.x += (mouse.x + 70 - pos.x) * 0.12;
        pos.y += (mouse.y - 50 - pos.y) * 0.12;
        floater.style.left = `${pos.x}px`;
        floater.style.top = `${pos.y}px`;
      }
      frame = requestAnimationFrame(follow);
    };

    const setStand = (on: boolean, { announce = true } = {}) => {
      standOn = on && isJojo();
      root().classList.toggle("jojo-stand-on", standOn);
      document
        .querySelectorAll("[data-stand-toggle]")
        .forEach((b) => b.setAttribute("aria-pressed", String(standOn)));
      try {
        window.localStorage.setItem(STAND_KEY, standOn ? "1" : "0");
      } catch {
        /* navigation privée : le Stand ne survivra pas au rechargement */
      }
      if (standOn && !floater) {
        // il sort de la souris et glisse vers la droite en apparaissant, comme dans l'anime
        pos = { x: mouse.x, y: mouse.y - 50 };
        floater = spawn("jojo-fx-sprite jojo-fx-floater");
        if (announce) {
          play(SOUNDS.stand, { volume: 0.9 });
        }
      }
      if (!standOn && floater) {
        if (announce) play(SOUNDS.standOut, { volume: 0.9 });
        const f = floater;
        floater = null;
        f.classList.add("jojo-fx-leave");
        f.addEventListener("animationend", () => f.remove(), { once: true });
      }
    };

    // ── La rafale ──
    let holdTimer = 0;
    let start = { x: 0, y: 0 };

    // Star Platinum frappe toujours vers la gauche : ses poings sont du côté gauche de l'image,
    // près de la souris.
    const placeRush = (r: Rush) => {
      r.star.style.left = `${mouse.x}px`;
      r.star.style.top = `${mouse.y}px`;
    };
    /** Le bout des poings : c'est là que les coups portent (case qui tremble, DIO, mots). */
    const fist = (r: Rush) => {
      const b = r.star.getBoundingClientRect();
      return { x: b.left + b.width * 0.06, y: b.top + b.height * 0.45 };
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
        const { x, y } = fist(r);
        // DIO à portée des poings : il sort The World, tourné vers Star Platinum
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
        shake(struck(x, y), 4, 120);
        if (roller) {
          jolt([roller.el], 6, 120);
          // 5 s de rafale sous le rouleau : il valse, sans attendre qu'on relâche
          r.pushedSince ??= performance.now();
          if (performance.now() - r.pushedSince >= ROLLER_PUSH_MS) {
            r.pushedSince = undefined;
            launchRoller();
            transient(
              "jojo-fx-final",
              { left: `${x}px`, top: `${y}px`, color: "#f4c430" },
              "ORA !",
            );
            transient("jojo-fx-ring", { left: `${x}px`, top: `${y}px` });
            quake(16, 500);
          }
        }
        if (performance.now() - r.startedAt > RUSH_MAX_MS) endRush(true);
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
      const { x, y } = fist(r);
      r.star.remove();
      r.world?.remove();
      floater?.classList.remove("jojo-fx-hidden");
      if (!final) return;
      transient("jojo-fx-final", { left: `${x}px`, top: `${y}px`, color: "#f4c430" }, "ORA !");
      transient("jojo-fx-ring", { left: `${x}px`, top: `${y}px` });
      transient("jojo-fx-don", { left: `${x - 70}px`, top: `${y - 80}px` }, "ドン");
      shake(struck(x, y), 8, 420);
      // rafale lâchée trop tôt sous le rouleau : il retombe bientôt
      if (roller) {
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
        quake(22, 650);
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
      // les personnages du décor : tout le corps répond (même sous une carte translucide)
      const jotaro = document.querySelector(".jojo-pose");
      const dio = document.querySelector(".jojo-dio");
      if (!roller && jotaro && within(jotaro, e.clientX, e.clientY, CHARACTER_PAD)) {
        return talking || yareYare(jotaro);
      }
      if (!roller && dio && within(dio, e.clientX, e.clientY, CHARACTER_PAD)) {
        return talking || menacing(dio);
      }
      if (!standOn) return;
      start = { x: e.clientX, y: e.clientY };
      holdTimer = window.setTimeout(beginRush, HOLD_MS);
    };
    const onMove = (e: PointerEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
      if (!rush && Math.hypot(mouse.x - start.x, mouse.y - start.y) > MOVE_TOLERANCE) {
        window.clearTimeout(holdTimer);
      }
    };
    const onUp = () => endRush(true);
    const onCancel = () => endRush(false);
    // page en arrière-plan : plus de rafale ni de son
    const onHidden = () => {
      if (document.hidden) endRush(false);
    };
    // Bulle qui explique une capacité de la fiche de Stand (d'où vient sa note).
    let tip: HTMLElement | null = null;
    const closeTip = () => {
      tip?.remove();
      tip = null;
    };
    const showTip = (stat: Element) => {
      closeTip();
      const r = stat.getBoundingClientRect();
      tip = document.createElement("div");
      tip.className = "jojo-fx-tip";
      tip.setAttribute("role", "status");
      const title = document.createElement("strong");
      title.textContent = stat.querySelector(".jojo-stand-label")?.textContent ?? "";
      const body = document.createElement("span");
      body.textContent = stat.getAttribute("data-stand-help") ?? "";
      tip.append(title, body);
      document.body.append(tip);
      // à droite de la capacité si la place le permet, sinon en dessous ; jamais hors de l'écran
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const right = r.right + 10 + w <= window.innerWidth - 8;
      const left = right ? r.right + 10 : Math.min(Math.max(r.left, 8), window.innerWidth - w - 8);
      const top = right ? r.top + r.height / 2 - h / 2 : r.bottom + 8;
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.min(Math.max(top, 8), window.innerHeight - h - 8)}px`;
      later(7000, closeTip);
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const stat = e.target.closest("[data-stand-help]");
      if (stat && isJojo()) return showTip(stat);
      closeTip();
      if (e.target.closest("[data-stand-toggle]") && isJojo()) setStand(!standOn);
    };
    // un appui long au doigt ouvrirait le menu contextuel en pleine rafale
    const onContext = (e: Event) => {
      if (rush) e.preventDefault();
    };
    // Préchargement des sprites (décodés d'avance) et des sons, une fois, dès que le thème JoJo est
    // affiché ; gardés en mémoire tant que l'app est ouverte.
    let preloaded: (HTMLImageElement | HTMLAudioElement)[] | null = null;
    const preload = () => {
      if (preloaded || root().dataset.theme !== "jojo") return;
      preloaded = [
        ...SPRITES.map((src) => {
          const img = new Image();
          img.src = src;
          img.decode().catch(() => {});
          return img;
        }),
        ...Object.values(SOUNDS).map((src) => {
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = src;
          return audio;
        }),
      ];
    };

    // le thème change sans recharger : on range le Stand hors du thème JoJo, on précharge en y
    // entrant
    const themeWatch = new MutationObserver(() => {
      preload();
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
        "<strong>ゴゴゴゴ…</strong><span>Allume le bouton <b>STAND</b> de ta fiche pour l'invoquer, puis maintiens le clic : <b>ORA ORA ORA</b> ! Va donc chercher DIO, en bas de l'écran… Et quand il arrête le temps, garde un œil sur lui.</span>";
      const close = () => hint.remove();
      hint.addEventListener("click", close);
      document.body.append(hint);
      later(14000, close);
    };
    later(2500, showHint);
    later(800, preload);
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
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      endRush(false);
      cancelAnimationFrame(frame);
      themeWatch.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      document.querySelector(".jojo-fx-hint")?.remove();
      closeTip();
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
