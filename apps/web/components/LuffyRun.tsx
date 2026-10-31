"use client";

import { cx, effectiveVolume, imagesReady, onVolumeChange, preloadImages, timeNow } from "@app/ui";
import {
  type AnimationEvent,
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { COMBO_LEAVE_MS, onComboChange, setStage, useHeaderStage } from "./headerStage";
import { LuffyCombo } from "./LuffyCombo";
import { LUFFY_GROUND } from "./luffyGround";

// planches du fruit, de Luffy et du combo (Luffy qui court, la boule qui le poursuit)
const IMAGES = [
  "/luffy/devil-fruit.png",
  "/luffy/luffy-sheet.png",
  "/luffy/luffy-run-sheet.png",
  "/orb/orb-sheet.png",
];
const FRAMES = 25;
const FRAME_MS = 50; // 20 images/s, comme le gif d'origine
const SRC_PX = 150; // taille d'une frame du gif
const SCALE = 0.38;
const SIZE = SRC_PX * SCALE; // 57 px, Luffy tient dans le header pieds sur le liseré
const GROUND_ROW = 142; // ligne du sol dans le gif
const GROUND_STEP = 5; // pas des profils de LUFFY_GROUND, en px source
const GROUND_AMP = 2.5; // le sol du gif, réduit, ne bougerait que de 3 px : on exagère le rebond
const REST_FRAME = 22; // debout, sol plat
const WAKE_FRAME = 23; // au réveil : il atterrit (et creuse le liseré) juste après son apparition
const MUSIC = "/audio/luffy.mp3";

// Fruit du démon (24 × 33 px), affiché en pixel art ×1.5 comme la boule, flottant sur le liseré.
const FRUIT_W = 24 * 1.5;
const FRUIT_H = 33 * 1.5;

// Durées des transitions, alignées sur les animations de globals.css.
const WAKE_MS = 850;
const SLEEP_MS = 620;

// Le liseré du header occupe sa dernière ligne de pixels (header h-14 = 56 px, Luffy aussi haut).
const LINE_Y = 55.5;
// Le sol déformé déborde de part et d'autre de Luffy et revient en douceur au liseré droit.
const PAD = 18;
const SVG_TOP = LINE_Y - 14;
const SVG_HEIGHT = 24;

// away : parti courir après la steel ball (combo), le fruit a éclaté et la case reste vide
type Phase = "idle" | "waking" | "playing" | "sleeping" | "away";

// Étincelles autour du fruit à l'arrêt : position de départ, durée et décalage différents pour
// qu'elles ne s'allument jamais toutes ensemble ; chacune change de place à chaque cycle.
const TWINKLES = [
  { left: 6, top: 10, duration: 2.6, delay: 0, cell: 2 },
  { left: 44, top: 20, duration: 3.1, delay: 0.8, cell: 1 },
  { left: 14, top: 38, duration: 2.9, delay: 1.6, cell: 1 },
  { left: 40, top: 4, duration: 3.4, delay: 2.3, cell: 2 },
];
// Éclats projetés quand le fruit éclate.
const BURST = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * 2 * Math.PI + 0.3;
  return { x: Math.cos(angle) * 26, y: Math.sin(angle) * 22 };
});

/** Profil du sol d'une frame en points (px affichés, origine au coin haut gauche du SVG). */
function groundPoints(frame: number) {
  const heights = LUFFY_GROUND[frame] ?? [];
  const y = (h: number) => LINE_Y - SVG_TOP - h * SCALE * GROUND_AMP;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const first = heights[0] ?? 0;
  const last = heights[heights.length - 1] ?? 0;
  const pts: [number, number][] = [];
  // Raccords hors de Luffy : on part du liseré droit et on rejoint la hauteur du bord (et retour).
  for (let i = 0; i < 6; i++) pts.push([(PAD * i) / 6, y(first * ease(i / 6))]);
  heights.forEach((h, i) => pts.push([PAD + i * GROUND_STEP * SCALE, y(h)]));
  for (let i = 1; i <= 6; i++) pts.push([PAD + SIZE + (PAD * i) / 6, y(last * ease(1 - i / 6))]);
  return pts;
}

/** Courbe lisse (Catmull-Rom) passant par les points. */
function smoothPath(pts: [number, number][]) {
  const f = (p: [number, number]) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const start = pts[0];
  if (!start) return "";
  let d = `M${f(start)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i] ?? start;
    const p0 = pts[i - 1] ?? p1;
    const p2 = pts[i + 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d;
}

/** Étincelle pixel art en croix (5 × 5 cases de `cell` px). */
function Sparkle({
  cell,
  className,
  style,
  onAnimationIteration,
}: {
  cell: number;
  className?: string;
  style?: CSSProperties;
  onAnimationIteration?: (e: AnimationEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      aria-hidden
      className={cx("pointer-events-none absolute block", className)}
      style={{ width: 5 * cell, height: 5 * cell, ...style }}
      onAnimationIteration={onAnimationIteration}
    >
      <svg
        viewBox="0 0 5 5"
        width={5 * cell}
        height={5 * cell}
        shapeRendering="crispEdges"
        style={{ filter: "drop-shadow(0 0 2px rgb(255 255 255 / 0.8))" }}
      >
        <rect x={2} y={0} width={1} height={5} fill="#ece6ff" />
        <rect x={0} y={2} width={5} height={1} fill="#ece6ff" />
        <rect x={2} y={2} width={1} height={1} fill="#fff" />
      </svg>
    </span>
  );
}

/**
 * Luffy (Gear 5) dans le header, à gauche de la boule. À l'arrêt, c'est son fruit du démon qui
 * flotte au-dessus du liseré, avec quelques étincelles. Un clic lance la musique (en boucle) : le
 * fruit tremble, éclate en lumière et Luffy en sort en rebondissant ; un second clic le renvoie
 * dans le fruit et coupe la musique. Le fond du gif est retiré : quand il retombe et rebondit,
 * c'est le liseré doré du header qui se creuse puis se bombe sous lui (déformation exagérée, et
 * Luffy suit la ligne). Pour ça, il demande au header de masquer son liseré sur sa largeur
 * (`--line-gap-from/to`) et le redessine lui-même, avec le même dégradé.
 */
export function LuffyRun() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [frame, setFrame] = useState(REST_FRAME);
  const [gradient, setGradient] = useState<{ x1: number; x2: number } | null>(null);
  // place de la case dans le header, pour le calque du combo
  const [geo, setGeo] = useState<{ offset: number; width: number } | null>(null);
  const [combo, setCombo] = useState<{ ballStart: number; luffyStart: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const stage = useHeaderStage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const running = phase === "waking" || phase === "playing";

  // La musique s'arrête quand on quitte la page.
  // Toutes les planches sont chargées dès l'affichage : le fruit devient Luffy sans blanc.
  useEffect(() => void preloadImages(IMAGES), []);
  useEffect(() => () => audioRef.current?.pause(), []);

  // Elle suit le volume global du header, même pendant la lecture.
  useEffect(
    () =>
      onVolumeChange(() => {
        if (audioRef.current) audioRef.current.volume = effectiveVolume();
      }),
    [],
  );

  // Trouée dans le liseré du header, recalculée quand le header ou ses boutons bougent.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = root?.closest("header");
    if (!root || !header) return;
    const update = () => {
      const h = header.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      if (r.width === 0) {
        // Masqué (petit écran) : le liseré reste entier.
        header.style.removeProperty("--line-gap-from");
        header.style.removeProperty("--line-gap-to");
        setGradient(null);
        return;
      }
      const left = r.left - h.left - PAD;
      header.style.setProperty("--line-gap-from", `${left}px`);
      header.style.setProperty("--line-gap-to", `${left + SIZE + 2 * PAD}px`);
      // Le dégradé du liseré, exprimé dans le repère du SVG.
      setGradient({ x1: -left, x2: h.width - left });
      setGeo({ offset: r.left - h.left, width: h.width });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(root);
    if (root.parentElement) observer.observe(root.parentElement);
    return () => {
      observer.disconnect();
      header.style.removeProperty("--line-gap-from");
      header.style.removeProperty("--line-gap-to");
    };
  }, []);

  // Fin des transitions.
  useEffect(() => {
    if (phase !== "waking" && phase !== "sleeping") return;
    const timer = setTimeout(
      () => setPhase(phase === "waking" ? "playing" : "idle"),
      phase === "waking" ? WAKE_MS : SLEEP_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let start = timeNow();
    let current = frame;
    // horloge commune : figée pendant un arrêt du temps (ZA WARUDO)
    const tick = () => {
      const now = timeNow();
      const steps = Math.floor((now - start) / FRAME_MS);
      if (steps > 0) {
        start += steps * FRAME_MS;
        current = (current + steps) % FRAMES;
        setFrame(current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // La frame de départ n'est lue qu'au lancement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Combo arrêté (clic sur la boule, ou fin) : Luffy rentre dans son fruit.
  useEffect(
    () =>
      onComboChange((on) => {
        if (on) return;
        // la boule et Luffy s'effacent, puis Luffy rentre dans son fruit
        setLeaving(true);
        window.setTimeout(() => {
          setLeaving(false);
          setCombo(null);
          setFrame(REST_FRAME);
          setPhase("sleeping");
        }, COMBO_LEAVE_MS);
      }),
    [],
  );

  function toggle() {
    // combo en cours : un clic sur le fruit l'arrête
    if (combo) {
      setStage({ combo: false });
      return;
    }
    // clic très tôt, planches pas encore là : il part dès qu'elles le sont (sinon il disparaîtrait)
    if (!running && !imagesReady(IMAGES)) {
      void preloadImages(IMAGES).then(toggle);
      return;
    }
    // la steel ball tourne et Luffy dort : combo, il sort du fruit pour lui courir après
    const header = rootRef.current?.closest("header");
    const orb = header?.querySelector("[data-spin-orb]");
    if (!running && stage.orbPlaying && header && orb && rootRef.current) {
      const h = header.getBoundingClientRect();
      const o = orb.getBoundingClientRect();
      const r = rootRef.current.getBoundingClientRect();
      setCombo({
        ballStart: o.left + o.width / 2 - h.left,
        luffyStart: r.left + r.width / 2 - h.left,
      });
      setStage({ combo: true });
      setPhase("away");
      return;
    }
    if (!audioRef.current) {
      const audio = new Audio(MUSIC);
      audio.loop = true;
      audio.volume = effectiveVolume();
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (running) {
      audio.pause();
      // Il se remet debout (sol plat) en rentrant dans le fruit.
      setFrame(REST_FRAME);
      setPhase("sleeping");
    } else {
      // Sans musique (fichier absent), il court quand même.
      audio.play().catch(() => {});
      setFrame(WAKE_FRAME);
      setPhase("waking");
    }
  }

  const points = groundPoints(phase === "idle" ? REST_FRAME : frame);
  const path = smoothPath(points);
  // Plus le sol se déforme, plus la partie qui bouge s'allume (le liseré est pâle à cet endroit).
  const bend = Math.max(...points.map(([, y]) => Math.abs(y - (LINE_Y - SVG_TOP))));
  // Luffy suit la ligne exagérée : décalé du surplus de déformation sous lui.
  const centerHeight = LUFFY_GROUND[frame]?.[15] ?? 0;
  const riding = phase === "idle" ? 0 : -(GROUND_AMP - 1) * centerHeight * SCALE;

  return (
    <div ref={rootRef} className="relative hidden h-14 shrink-0 sm:block" style={{ width: SIZE }}>
      {gradient && (
        <svg
          aria-hidden
          className="pointer-events-none absolute overflow-visible"
          style={{ left: -PAD, top: SVG_TOP }}
          width={SIZE + 2 * PAD}
          height={SVG_HEIGHT}
        >
          <defs>
            <linearGradient
              id={`${uid}-line`}
              gradientUnits="userSpaceOnUse"
              x1={gradient.x1}
              x2={gradient.x2}
              y1={0}
              y2={0}
            >
              <stop offset="0" style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
              <stop offset="0.5" style={{ stopColor: "var(--color-accent)", stopOpacity: 0.6 }} />
              <stop offset="1" style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient
              id={`${uid}-bend`}
              gradientUnits="userSpaceOnUse"
              x1={0}
              x2={SIZE + 2 * PAD}
              y1={0}
              y2={0}
            >
              <stop offset="0" style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
              <stop offset="0.3" style={{ stopColor: "var(--color-accent)", stopOpacity: 1 }} />
              <stop offset="0.7" style={{ stopColor: "var(--color-accent)", stopOpacity: 1 }} />
              <stop offset="1" style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke={`url(#${uid}-line)`} strokeWidth={1} />
          {bend > 0.5 && (
            <path
              d={path}
              fill="none"
              stroke={`url(#${uid}-bend)`}
              strokeWidth={1.5}
              opacity={Math.min(0.9, bend / 8)}
            />
          )}
        </svg>
      )}
      {combo && geo && (
        <LuffyCombo
          offset={geo.offset}
          width={geo.width}
          ballStart={combo.ballStart}
          luffyStart={combo.luffyStart}
          leaving={leaving}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={combo ? "Arrêter le combo" : running ? "Mettre Luffy en pause" : "Lancer Luffy"}
        aria-pressed={running}
        title={running ? "Pause" : "Luffy"}
        className="absolute inset-x-0 top-0 h-full rounded-md transition-[filter] hover:brightness-125"
      >
        {phase !== "playing" && (
          <span
            aria-hidden
            className={cx(
              "absolute block",
              phase === "idle" && "luffy-fruit-idle",
              (phase === "waking" || phase === "away") && "luffy-fruit-awaken",
              phase === "sleeping" && "luffy-fruit-return",
            )}
            style={{
              left: (SIZE - FRUIT_W) / 2,
              top: LINE_Y - 0.5 - FRUIT_H - 3,
              width: FRUIT_W,
              height: FRUIT_H,
              transformOrigin: "50% 60%",
              backgroundImage: "url(/luffy/devil-fruit.png)",
              backgroundSize: "100% 100%",
              imageRendering: "pixelated",
            }}
          />
        )}
        {phase === "idle" &&
          TWINKLES.map((t, i) => (
            <Sparkle
              key={i}
              cell={t.cell}
              className="luffy-twinkle"
              style={
                {
                  left: t.left,
                  top: t.top,
                  "--twinkle-duration": `${t.duration}s`,
                  "--twinkle-delay": `${t.delay}s`,
                } as CSSProperties
              }
              onAnimationIteration={(e) => {
                // Nouvelle place à chaque cycle, n'importe où autour du fruit.
                e.currentTarget.style.left = `${2 + Math.random() * (SIZE - 12)}px`;
                e.currentTarget.style.top = `${2 + Math.random() * 40}px`;
              }}
            />
          ))}
        {(phase === "waking" || phase === "sleeping" || phase === "away") && (
          <span
            aria-hidden
            className="luffy-flash pointer-events-none absolute block rounded-full"
            style={{
              left: SIZE / 2 - 24,
              top: 30 - 24,
              width: 48,
              height: 48,
              background:
                "radial-gradient(circle, #fff 0%, rgb(255 255 255 / 0.7) 30%, rgb(236 230 255 / 0) 70%)",
              animationDelay: phase === "sleeping" ? "0ms" : undefined,
            }}
          />
        )}
        {(phase === "waking" || phase === "away") &&
          BURST.map((b, i) => (
            <Sparkle
              key={i}
              cell={i % 2 ? 1 : 2}
              className="luffy-burst"
              style={
                {
                  left: SIZE / 2 - 4,
                  top: 26,
                  "--burst-x": `${b.x}px`,
                  "--burst-y": `${b.y}px`,
                } as CSSProperties
              }
            />
          ))}
        {phase !== "idle" && phase !== "away" && (
          <span
            aria-hidden
            className={cx(
              "absolute left-0 block",
              phase === "waking" && "luffy-pop",
              phase === "playing" && "luffy-glow",
              phase === "sleeping" && "luffy-unpop",
            )}
            style={{
              top: LINE_Y - 0.5 - GROUND_ROW * SCALE,
              width: SIZE,
              height: SIZE,
              translate: `0 ${riding}px`,
              transformOrigin: `50% ${(GROUND_ROW / SRC_PX) * 100}%`,
              backgroundImage: "url(/luffy/luffy-sheet.png)",
              backgroundSize: `${FRAMES * SIZE}px ${SIZE}px`,
              backgroundPosition: `${-frame * SIZE}px 0`,
            }}
          />
        )}
      </button>
    </div>
  );
}
