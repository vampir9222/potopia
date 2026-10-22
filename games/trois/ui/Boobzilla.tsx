"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confetti } from "./confetti";
import { setChaos, silly, startMusic, stopMusic } from "./sound";

// 🤫 Mode secret : taper « boobzilla » n'importe où (clavier physique ou clavier du jeu).
// Purement visuel et sonore : rien n'est envoyé au serveur, rien ne change dans la partie.

const SECRET = "boobzilla";
let buffer = "";
const triggers = new Set<() => void>();

/** Une lettre tapée, d'où qu'elle vienne. Déclenche le mode quand le mot secret est complet. */
export function feedSecret(letter: string) {
  buffer = (buffer + letter.toLowerCase()).slice(-SECRET.length);
  if (buffer === SECRET) {
    buffer = "";
    triggers.forEach((t) => t());
  }
}

const EMOJIS = [
  "🦖",
  "🍑",
  "🍒",
  "💥",
  "🌈",
  "🦄",
  "🔥",
  "🎉",
  "👾",
  "🧀",
  "🐸",
  "💨",
  "🍆",
  "🥓",
  "🦆",
  "🌭",
  "🤡",
  "🛸",
  "🍕",
  "💩",
  "🐙",
  "🎺",
];
const SLOGANS = [
  "BOOBZILLA",
  "RAAAWR",
  "PROUT",
  "MAXIMUM CHAOS",
  "OUI",
  "🦖🦖🦖",
  "TROIS ? NON : ∞",
  "WOUBWOUB",
];

type Sprite = {
  el: HTMLSpanElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
};

export function Boobzilla() {
  const [on, setOn] = useState(false);
  const [slogan, setSlogan] = useState(SLOGANS[0]);
  const layer = useRef<HTMLDivElement>(null);
  const sprites = useRef<Sprite[]>([]);

  const enter = useCallback(() => {
    setOn(true);
    window.dispatchEvent(new Event("boobzilla"));
  }, []);

  const exit = useCallback(() => {
    setOn(false);
    silly.sadTrombone();
  }, []);

  // détection au clavier physique, sur tous les onglets
  useEffect(() => {
    triggers.add(enter);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\p{L}$/u.test(e.key)) feedSecret(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      triggers.delete(enter);
      window.removeEventListener("keydown", onKey);
    };
  }, [enter]);

  // tout ce qui ne vit que pendant le mode
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.classList.add("boobzilla");
    setChaos(true);
    silly.roar();
    silly.airhorn(1.2);
    confetti({ big: true });
    const music = setTimeout(startMusic, 1800);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const spawn = (x: number, y: number, speed: number, life = Infinity) => {
      const el = document.createElement("span");
      el.textContent = EMOJIS[(Math.random() * EMOJIS.length) | 0] ?? "🦖";
      el.className = "boobzilla-sprite";
      el.style.fontSize = `${24 + Math.random() * 40}px`;
      layer.current?.appendChild(el);
      const a = Math.random() * Math.PI * 2;
      sprites.current.push({
        el,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        rot: 0,
        vr: (Math.random() - 0.5) * 20,
        life,
      });
    };

    // la horde de départ, qui rebondit sur les bords façon logo DVD
    for (let i = 0; i < 24; i++)
      spawn(Math.random() * W(), Math.random() * H(), 2 + Math.random() * 5);

    let raf = 0;
    let lastBounce = 0;
    const frame = (now: number) => {
      sprites.current = sprites.current.filter((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vr;
        s.life--;
        if (s.life !== Infinity)
          s.vy += 0.3; // les éclats retombent
        else {
          if (s.x < 0 || s.x > W() - 40) {
            s.vx *= -1;
            s.x = Math.max(0, Math.min(W() - 40, s.x));
            if (now - lastBounce > 700 && Math.random() < 0.3) {
              silly.random();
              lastBounce = now;
            }
          }
          if (s.y < 0 || s.y > H() - 40) {
            s.vy *= -1;
            s.y = Math.max(0, Math.min(H() - 40, s.y));
          }
        }
        if (s.life <= 0 || s.y > H() + 100) return void s.el.remove();
        s.el.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)`;
        return true;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // un clic n'importe où : explosion d'emojis + bruit au hasard (le clic marche toujours en dessous)
    const onDown = (e: PointerEvent) => {
      silly.random();
      for (let i = 0; i < 10; i++) spawn(e.clientX, e.clientY, 6 + Math.random() * 8, 70);
    };
    // traînée d'étincelles derrière le curseur
    let lastTrail = 0;
    const onMove = (e: PointerEvent) => {
      if (e.timeStamp - lastTrail < 40) return;
      lastTrail = e.timeStamp;
      spawn(e.clientX, e.clientY, 1 + Math.random() * 2, 30);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exit();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);

    // un nouveau slogan et un petit prout toutes les quelques secondes
    const slogans = setInterval(() => {
      setSlogan(SLOGANS[(Math.random() * SLOGANS.length) | 0]);
      if (Math.random() < 0.4) silly.fart();
    }, 2500);

    return () => {
      root.classList.remove("boobzilla");
      setChaos(false);
      stopMusic();
      clearTimeout(music);
      clearInterval(slogans);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      sprites.current.forEach((s) => s.el.remove());
      sprites.current = [];
    };
  }, [on, exit]);

  if (!on) return null;

  return (
    <>
      <div ref={layer} className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
        <div className="boobzilla-frame absolute inset-0" />
        <p
          key={slogan}
          className="boobzilla-title absolute top-[18%] left-1/2 text-5xl font-black whitespace-nowrap sm:text-8xl"
        >
          {slogan}
        </p>
        <span
          className="boobzilla-kaiju absolute bottom-0 text-[120px] sm:text-[180px]"
          onAnimationIteration={() => silly.roar()}
        >
          🦖
        </span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          exit();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="boobzilla-exit fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-6 py-3 text-lg font-black text-white shadow-2xl"
      >
        🚪 Sortir du mode BOOBZILLA
      </button>
    </>
  );
}
