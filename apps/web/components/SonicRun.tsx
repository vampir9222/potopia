"use client";

import {
  setSuperSonicTransformed,
  useEmeraldsDisabled,
  useSuperSonicTransformed,
} from "@app/inventory/ui";
import { cx, effectiveVolume, imagesReady, onVolumeChange, preloadImages, timeNow } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { LoopTrack } from "./loopTrack";

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
  ssIdle: { src: "/sonic/sonic-ss-idle.png", frames: 3, w: 24, h: 48 },
} satisfies Record<string, Sheet>;
type SheetName = keyof typeof SHEETS;
const SHEET_SRCS = Object.values(SHEETS).map((s) => s.src);

const MUSIC = "/audio/sonic.mp3";
// Super Sonic : le morceau d'origine boucle tout seul (thème de 19,69 s qui se répète dès le
// début, puis un fondu de sortie vers 64 s). On boucle sur trois tours exacts, sans fondu ni blanc.
const SUPER_MUSIC = "/audio/super-sonic.mp3";
const SUPER_LOOP_START = 0.501;
const SUPER_LOOP_END = SUPER_LOOP_START + 3 * 19.6906;
const WIDTH = 48;
// Le liseré du header occupe sa dernière ligne de pixels (header h-14 = 56 px) : les pieds dessus.
const LINE_Y = 55;
// Transformation en Super Sonic : le rythme du gif d'origine, un peu accéléré.
const TRANS_MS = [190, 190, 190, 190, 190, 190, 190, 380];
// Super Sonic démarre en trottinant puis accélère (images de plus en plus rapprochées, traînée
// qui s'allonge), avant de s'envoler.
const SUPER_RUN_MS = 4500;
const SUPER_RAMP_MS = 1400;
// hauteur de vol moyenne, pour laquelle sont placés les traits de vitesse du vol (globals.css)
const FLY_LIFT = 9;
// Vent du vol : cinq traits dessinés en SVG. Le bout côté Sonic suit sa hauteur de vol, et chaque
// point plus à gauche reprend la hauteur qu'il avait un peu plus tôt : l'oscillation se propage
// vers la gauche en petites vagues.
const WIND_W = 260;
const WIND_H = 40;
const WIND_LAG_MS_PER_PX = 2.4;
const WIND_STEP_PX = 8;
const WIND_SWELL = 1.6;
const WIND_LINES = [
  { y: 7, width: 2, color: "rgb(255 250 200)", dash: "40 16" },
  { y: 13, width: 3, color: "rgb(255 215 70)", dash: "60 14" },
  { y: 19, width: 2, color: "rgb(255 240 160)", dash: "30 16" },
  { y: 25, width: 3, color: "rgb(255 200 50)", dash: "70 14" },
  { y: 32, width: 2, color: "rgb(255 245 180)", dash: "36 14" },
];
const SUPER_STEP_SLOW = 190;
// à pleine vitesse, bien plus vite que Sonic (40 ms) : c'est Super Sonic
const SUPER_STEP_FAST = 24;

const STREAK_COLORS = {
  // la couleur du liseré du thème (Classique, Fantasy, RGB…), avec une tête blanche
  accent: "linear-gradient(to left, rgb(255 255 255 / 0.95), var(--accent) 35%, transparent)",
  gold: "linear-gradient(to left, rgb(255 250 210 / 1), rgb(255 200 40 / 0.8) 35%, transparent)",
};

type Mode = "idle" | "running" | "super";
// Super Sonic en attente lévite au-dessus du liseré (son gif a les pieds figés : flotter les rend
// naturels), en oscillant doucement.
const SUPER_IDLE_LIFT = 4;

/**
 * Sonic dans le header. À l'arrêt il attend en tapant du pied ; un clic lance sa musique : il
 * marche, prend de la vitesse, court, et pique de temps en temps un sprint, avec une traînée sur
 * le liseré. Second clic : retour au calme. Avec les 7 Émeraudes du Chaos (`superSonic`), le clic
 * le transforme en Super Sonic, qui sprinte puis s'envole. Une fois transformé, il le reste : son
 * attente devient celle de Super Sonic et les clics suivants sautent la transformation. Les
 * émeraudes peuvent être mises de côté depuis l'inventaire (Sonic de base).
 */
export function SonicRun({ superSonic: allEmeralds }: { superSonic: boolean }) {
  const [mode, setMode] = useState<Mode>("idle");
  const disabled = useEmeraldsDisabled();
  const transformed = useSuperSonicTransformed();
  const superSonic = allEmeralds && !disabled;
  const superIdle = superSonic && transformed;
  // seule l'attente dépend de la transformation : pendant la course, la noter ne relance rien
  const idleSuper = mode === "idle" && superIdle;
  const spriteRef = useRef<HTMLSpanElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const linesRef = useRef<HTMLSpanElement>(null);
  const windRef = useRef<SVGSVGElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const superTrack = useRef<LoopTrack | null>(null);

  // Toutes les planches sont chargées dès l'affichage : passer de l'une à l'autre est instantané.
  useEffect(() => void preloadImages(SHEET_SRCS), []);

  // La musique s'arrête quand on quitte la page, et suit le volume global du header.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      superTrack.current?.stop();
    },
    [],
  );
  useEffect(
    () =>
      onVolumeChange(() => {
        if (audioRef.current) audioRef.current.volume = effectiveVolume();
        superTrack.current?.setVolume(effectiveVolume());
      }),
    [],
  );

  // transformation déjà faite au moment du clic (lue une fois par lancement)
  const startTransformedRef = useRef(false);

  useEffect(() => {
    const sprite = spriteRef.current;
    const streak = streakRef.current;
    const lines = linesRef.current;
    const wind = windRef.current;
    const startTransformed = startTransformedRef.current;
    if (!sprite || !streak || !lines || !wind) return;
    const windPaths = Array.from(wind.querySelectorAll("path"));
    // hauteurs de vol récentes, pour que la vague parte de Sonic et file vers la gauche
    const history: [number, number][] = [];
    const liftAt = (time: number) => {
      for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i];
        if (h && h[0] <= time) return h[1];
      }
      return history[0]?.[1] ?? FLY_LIFT;
    };
    const blow = (now: number, lift: number) => {
      history.push([now, lift]);
      while (
        history.length > 2 &&
        (history[0]?.[0] ?? now) < now - WIND_W * WIND_LAG_MS_PER_PX - 100
      )
        history.shift();
      windPaths.forEach((path, j) => {
        const base = WIND_LINES[j]?.y ?? 0;
        let d = "";
        for (let x = WIND_W; x >= 0; x -= WIND_STEP_PX) {
          // la vague s'amplifie en s'éloignant de lui, comme un ruban qui claque au vent
          const far = (WIND_W - x) / WIND_W;
          const y =
            base -
            (liftAt(now - (WIND_W - x) * WIND_LAG_MS_PER_PX) - FLY_LIFT) * (1 + far * WIND_SWELL);
          d += `${d ? "L" : "M"}${x},${y.toFixed(1)}`;
        }
        path.setAttribute("d", d);
      });
    };
    // effets de vitesse de Super Sonic (0 à 1) : images rémanentes derrière lui, lignes de vitesse
    // en vol (`fly`), tout passe un cran au-dessus : plus d'images rémanentes, plus loin, plus
    // vite, et des lignes de vitesse plus nombreuses et plus longues
    let level: "" | "run" | "fly" = "";
    // nouvel état (attente comprise) : aucun effet de vitesse ne reste accroché du précédent
    sprite.classList.remove("sonic-ghost", "sonic-ghost-fly");
    lines.style.opacity = "0";
    wind.style.opacity = "0";
    // `lift` : hauteur de vol de Super Sonic ; les traits montent et descendent avec lui
    const rush = (k: number, fly = false, now = 0, lift = FLY_LIFT, plain = false) => {
      lines.classList.toggle("sonic-speedlines-plain", plain);
      // traits discrets : ils accompagnent le dédoublement sans le cacher. En vol, le vent en SVG
      // (qui ondule) remplace les traits droits de la course.
      const k01 = Math.max(0, Math.min(1, k));
      lines.style.opacity = fly ? "0" : String(k01 * 0.55);
      lines.style.width = `${Math.round(40 + 80 * k)}px`;
      wind.style.opacity = fly ? String(k01 * 0.6) : "0";
      if (fly) blow(now, lift);
      // Sonic de base : traits seulement, pas d'images rémanentes (réservées à Super Sonic)
      const next = fly ? "fly" : k > 0.5 && !plain ? "run" : "";
      if (next !== level) {
        level = next;
        sprite.classList.toggle("sonic-ghost", next === "run");
        sprite.classList.toggle("sonic-ghost-fly", next === "fly");
      }
    };
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
    // traînée : longueur, couleur, et vitesse de défilement des tirets (un tiret toutes les
    // `dashMs` ms : plus il court vite, plus ils filent)
    let dashMs = 0;
    const trail = (length: number, color: keyof typeof STREAK_COLORS, dash = 180) => {
      streak.style.width = `${Math.round(length)}px`;
      streak.style.opacity = length > 4 ? "1" : "0";
      streak.style.backgroundImage = STREAK_COLORS[color];
      const ms = Math.round(dash / 10) * 10;
      if (ms !== dashMs) {
        dashMs = ms;
        streak.style.animationDuration = `${ms}ms`;
      }
    };

    let raf = 0;
    const start = timeNow();
    // vitesse du sprint : un boost de temps en temps pendant la course
    let boostUntil = 0;
    let nextBoost = start + 3500;
    let frame = 0;
    let lastStep = start;
    let noted = false;

    // horloge commune : figée pendant un arrêt du temps (ZA WARUDO)
    const tick = () => {
      const now = timeNow();
      const t = now - start;
      if (idleSuper) {
        show("ssIdle", Math.floor(t / 140), SUPER_IDLE_LIFT + 2 * Math.sin(now / 520));
        trail(0, "gold");
        rush(0);
      } else if (mode === "idle") {
        // il attend : une longue pause, puis trois petits mouvements (le gif d'origine allait trop vite)
        const cycle = t % 2650;
        show("idle", cycle < 2200 ? 0 : 1 + Math.floor((cycle - 2200) / 150));
        trail(0, "accent");
        rush(0);
      } else if (mode === "running") {
        if (now > nextBoost) {
          // sprint bien long : 4,5 à 7 s
          boostUntil = now + 4500 + Math.random() * 2500;
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
        // longueurs à l'échelle du vol de Super Sonic (le plus long, 600 px)
        if (name === "walk") trail(0, "accent");
        else if (name === "run") trail(90, "accent", 220);
        else trail(210 + 25 * Math.sin(now / 60), "accent", 120);
        // au sprint, Sonic a lui aussi ses petits traits de vitesse (à la couleur du thème)
        rush(name === "fast" ? 0.45 : 0, false, now, FLY_LIFT, true);
      } else {
        // déjà transformé : il repart directement en courant
        const transTotal = startTransformed ? 0 : TRANS_MS.reduce((a, b) => a + b, 0);
        if (t >= transTotal && !startTransformed && !noted) {
          noted = true;
          setSuperSonicTransformed();
        }
        if (t < transTotal) {
          let acc = 0;
          let i = 0;
          while (i < TRANS_MS.length - 1 && t >= acc + (TRANS_MS[i] ?? 0))
            acc += TRANS_MS[i++] ?? 0;
          show("trans", i);
          trail(0, "gold");
          rush(0);
        } else if (t < transTotal + SUPER_RUN_MS) {
          const ramp = Math.min(1, (t - transTotal) / SUPER_RAMP_MS);
          const eased = ramp * ramp * (3 - 2 * ramp);
          const step = SUPER_STEP_SLOW + (SUPER_STEP_FAST - SUPER_STEP_SLOW) * eased;
          if (now - lastStep >= step) {
            frame += 1;
            lastStep = now;
          }
          show("ssRun", frame);
          // les tirets accélèrent avec lui (de 300 ms à 70 ms par tiret)
          trail(eased * (320 + 30 * Math.sin(now / 40)), "gold", 300 - 230 * eased);
          rush(eased * 0.8);
        } else {
          // il décolle, puis flotte au-dessus du liseré
          const flight = t - transTotal - SUPER_RUN_MS;
          const lift = Math.min(9, flight / 40) + 2 * Math.sin(now / 300);
          show("ssFly", Math.floor(t / 70), lift);
          // en vol : traînée immense, tirets qui défilent à toute allure (toujours dorée, quel que
          // soit le thème)
          trail(600 + 60 * Math.sin(now / 35), "gold", 30);
          rush(1, true, now, lift);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, idleSuper]);

  function toggle() {
    // clic très tôt, planches pas encore là : il part dès qu'elles le sont (sinon il disparaîtrait)
    if (mode === "idle" && !imagesReady(SHEET_SRCS)) {
      void preloadImages(SHEET_SRCS).then(toggle);
      return;
    }
    audioRef.current?.pause();
    superTrack.current?.stop();
    if (mode !== "idle") {
      setMode("idle");
      return;
    }
    const next: Mode = superSonic ? "super" : "running";
    startTransformedRef.current = transformed;
    if (next === "super") {
      superTrack.current ??= new LoopTrack(SUPER_MUSIC, SUPER_LOOP_START, SUPER_LOOP_END);
      superTrack.current.play(effectiveVolume()).catch(() => {});
    } else {
      audioRef.current ??= Object.assign(new Audio(MUSIC), { loop: true });
      const audio = audioRef.current;
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
      {/* lignes de vitesse dorées derrière Super Sonic */}
      <span
        ref={linesRef}
        aria-hidden
        className="sonic-speedlines pointer-events-none absolute opacity-0"
        style={{ right: WIDTH / 2 + 6, top: LINE_Y - 36, height: 28 }}
      />
      {/* vent du vol de Super Sonic : traits qui ondulent en vagues vers la gauche */}
      <svg
        ref={windRef}
        aria-hidden
        className="sonic-wind pointer-events-none absolute overflow-visible opacity-0"
        style={{ right: WIDTH / 2 + 6, top: LINE_Y - 36 - 7 - FLY_LIFT + 2 }}
        width={WIND_W}
        height={WIND_H}
      >
        {WIND_LINES.map((l, i) => (
          <path
            key={i}
            fill="none"
            stroke={l.color}
            strokeWidth={l.width}
            strokeDasharray={l.dash}
            strokeLinecap="round"
          />
        ))}
      </svg>
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
          className={cx("absolute block", (mode === "super" || superIdle) && "sonic-super")}
          style={{ imageRendering: "pixelated" }}
        />
      </button>
    </div>
  );
}
