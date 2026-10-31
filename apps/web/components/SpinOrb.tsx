"use client";

import { cx, effectiveVolume, onVolumeChange, timeNow } from "@app/ui";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Square } from "lucide-react";
import { COMBO_CHARGE_MS, fadeAudio, onComboChange, setStage, useHeaderStage } from "./headerStage";

const FRAMES = 48;
const FRAME_PX = 32;
const WIND_FRAMES = 8;
const WIND_PX = 48;
// 46 px (au lieu de 48) : un chouïa plus petite, en restant sur des pixels entiers (planches
// sans débordement d'une image sur l'autre)
const SCALE = 46 / 32;
const SIZE = FRAME_PX * SCALE;
const WIND_SIZE = WIND_PX * SCALE;
const REST_FRAME = 8; // à l'arrêt : un hexagone de trois quarts
const MUSIC = "/audio/spin2.mp3";

// Vitesses en tours par seconde.
const CRUISE = 2;
const CRUISE_SWING = 0.6;
const BOOST_MIN = 9;
const BOOST_MAX = 15;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Au repos, de temps en temps (toutes les 5 à 11 s) : la spirale dorée de la « Golden Rotation »
// se dessine sur la boule, ou elle fait un petit rebond sur place, comme lancée et rattrapée. Tiré
// au hasard à chaque fois : le même peut revenir plusieurs fois de suite.
const IDLE_MIN_MS = 5000;
const IDLE_MAX_MS = 11000;
const SPIRAL_MS = 2200;
const HOP_MS = 750;

/** Spirale d'or (rayon × φ à chaque quart de tour), centrée sur la boule, en coordonnées 0–100. */
const GOLDEN_SPIRAL = (() => {
  const b = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2);
  const turns = 3 * Math.PI;
  const scale = 40 / Math.exp(b * turns);
  let d = "";
  for (let a = 0; a <= turns; a += 0.12) {
    const r = scale * Math.exp(b * a);
    const x = 50 + r * Math.cos(a);
    const y = 50 - r * Math.sin(a);
    d += `${d ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d;
})();

function sheet(src: string, frames: number, px: number, frame = 0): CSSProperties {
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: `${frames * px}px ${px}px`,
    backgroundPosition: `${-frame * px}px 0`,
    imageRendering: "pixelated",
  };
}

/**
 * Boule pixel art qui tourne. Un clic lance la rotation et la musique (en boucle), un second clic
 * met en pause les deux. La boule tourne vite, avec de temps en temps un gros boost : elle passe
 * alors sur des frames floutées (les traits disparaissent) et du vent s'enroule autour.
 */
export function SpinOrb() {
  const [playing, setPlaying] = useState(false);
  const [fast, setFast] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const phaseRef = useRef(REST_FRAME / FRAMES); // position dans le tour, gardée pendant la pause
  const sharpRef = useRef<HTMLSpanElement>(null);
  const blur1Ref = useRef<HTMLSpanElement>(null);
  const blur2Ref = useRef<HTMLSpanElement>(null);
  const windRef = useRef<HTMLSpanElement>(null);
  // combo avec Luffy : la boule quitte sa place pour rouler sur le liseré (LuffyCombo)
  const { combo } = useHeaderStage();

  // Luffy l'emmène : elle se charge dans sa case pendant que sa musique s'éteint, puis part
  // rouler ; sa case montre alors un bouton stop pour annuler le combo.
  const [comboStage, setComboStage] = useState<"off" | "charging" | "away">("off");
  const [idleFx, setIdleFx] = useState<"spiral" | "hop" | null>(null);
  useEffect(
    () =>
      onComboChange((on) => {
        if (!on) {
          setComboStage("off");
          return;
        }
        setComboStage("charging");
        fadeAudio(audioRef.current, 0, COMBO_CHARGE_MS);
        window.setTimeout(() => {
          setPlaying(false);
          setComboStage((s) => (s === "charging" ? "away" : s));
        }, COMBO_CHARGE_MS);
      }),
    [],
  );

  // Au repos (ni musique, ni combo) : spirale ou rebond, au hasard, de temps en temps.
  useEffect(() => {
    if (playing || combo) return;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(
        () => {
          const fx = Math.random() < 0.5 ? "spiral" : "hop";
          setIdleFx(fx);
          timer = window.setTimeout(
            () => {
              setIdleFx(null);
              next();
            },
            fx === "spiral" ? SPIRAL_MS : HOP_MS,
          );
        },
        IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS),
      );
    };
    next();
    return () => {
      window.clearTimeout(timer);
      setIdleFx(null);
    };
  }, [playing, combo]);

  // Les combos du header ont besoin de savoir si elle tourne.
  useEffect(() => setStage({ orbPlaying: playing }), [playing]);

  // La musique s'arrête quand on quitte la page.
  useEffect(() => () => audioRef.current?.pause(), []);

  // Elle suit le volume global du header, même pendant la lecture.
  useEffect(
    () =>
      onVolumeChange(() => {
        if (audioRef.current) audioRef.current.volume = effectiveVolume();
      }),
    [],
  );

  useEffect(() => {
    if (!playing) return;
    const layers = [sharpRef.current, blur1Ref.current, blur2Ref.current];
    const [, blur1, blur2] = layers;
    const wind = windRef.current;
    let raf = 0;
    let last = timeNow();
    let boost = 6; // démarrage lancé
    let target = 0;
    let holdUntil = 0;
    let nextBoost = last + 1500 + Math.random() * 2000;
    let windPhase = 0;
    let wasFast = false;

    // horloge commune : figée pendant un arrêt du temps (ZA WARUDO)
    const tick = () => {
      const now = timeNow();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Boost : la boule s'emballe, tient sa vitesse max un instant, puis redescend.
      if (now > nextBoost) {
        target = BOOST_MIN + Math.random() * (BOOST_MAX - BOOST_MIN);
        holdUntil = now + 700 + Math.random() * 1000;
        nextBoost = now + 3500 + Math.random() * 4000;
      }
      if (target > 0 && now > holdUntil) target = 0;
      const rate = target > boost ? 5 : 1.3; // montée sèche, descente douce
      boost += (target - boost) * (1 - Math.exp(-rate * dt));

      const speed = CRUISE + CRUISE_SWING * Math.sin(now / 1500) + boost;
      phaseRef.current = (phaseRef.current + speed * dt) % 1;
      const frame = Math.floor(phaseRef.current * FRAMES) % FRAMES;
      for (const layer of layers) {
        if (layer) layer.style.backgroundPosition = `${-frame * SIZE}px 0`;
      }

      // Plus ça va vite, plus on montre les frames floutées et le vent.
      if (blur1) blur1.style.opacity = String(clamp01((speed - 3.5) / 2.5));
      if (blur2) blur2.style.opacity = String(clamp01((speed - 6.5) / 3));
      if (wind) {
        windPhase = (windPhase + dt * (10 + speed * 1.5)) % WIND_FRAMES;
        wind.style.opacity = String(clamp01((speed - 6) / 3));
        wind.style.backgroundPosition = `${-Math.floor(windPhase) * WIND_SIZE}px 0`;
      }
      // Halo « turbo » : un rendu React seulement quand on franchit le seuil, pas à chaque frame.
      const isFast = speed > 6.5;
      if (isFast !== wasFast) {
        wasFast = isFast;
        setFast(isFast);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // En pause, la boule redevient nette et le vent tombe.
      for (const el of [blur1, blur2, wind]) if (el) el.style.opacity = "0";
      setFast(false);
    };
  }, [playing]);

  function toggle() {
    // pendant le combo, un clic sur sa case la ramène
    if (combo) {
      setStage({ combo: false });
      return;
    }
    if (!audioRef.current) {
      const audio = new Audio(MUSIC);
      audio.loop = true;
      audio.volume = effectiveVolume();
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      // le combo l'a peut-être éteinte en fondu (volume à 0) : on le remet
      audio.volume = effectiveVolume();
      audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        combo ? "Arrêter le combo" : playing ? "Mettre la musique en pause" : "Lancer la musique"
      }
      aria-pressed={playing || combo}
      title={combo ? "Arrêter le combo" : playing ? "Pause" : "Musique"}
      className="hover:bg-surface relative rounded-md p-1 transition-transform hover:scale-110"
    >
      {comboStage === "away" && (
        <span
          aria-hidden
          className="combo-stop border-accent/70 bg-surface text-accent absolute inset-1.5 grid place-items-center rounded-full border-2"
        >
          <Square size={14} fill="currentColor" />
        </span>
      )}
      <span
        aria-hidden
        data-spin-orb
        className={cx(
          "relative block transition-opacity duration-500",
          playing && "orb-glow",
          fast && "orb-fast",
          comboStage === "charging" && "orb-charge",
          !playing && idleFx === "hop" && "orb-hop",
          comboStage === "away" && "opacity-0",
        )}
        style={{ width: SIZE, height: SIZE }}
      >
        <span
          ref={sharpRef}
          className="absolute inset-0"
          style={sheet("/orb/orb-sheet.png", FRAMES, SIZE, REST_FRAME)}
        />
        <span
          ref={blur1Ref}
          className="absolute inset-0 opacity-0"
          style={sheet("/orb/orb-blur-1.png", FRAMES, SIZE, REST_FRAME)}
        />
        <span
          ref={blur2Ref}
          className="absolute inset-0 opacity-0"
          style={sheet("/orb/orb-blur-2.png", FRAMES, SIZE, REST_FRAME)}
        />
        {!playing && idleFx === "spiral" && (
          <svg viewBox="0 0 100 100" className="orb-spiral absolute inset-0 overflow-visible">
            <path d={GOLDEN_SPIRAL} pathLength={100} fill="none" />
          </svg>
        )}
        <span
          ref={windRef}
          className="pointer-events-none absolute opacity-0"
          style={{
            ...sheet("/orb/orb-wind.png", WIND_FRAMES, WIND_SIZE),
            width: WIND_SIZE,
            height: WIND_SIZE,
            left: (SIZE - WIND_SIZE) / 2,
            top: (SIZE - WIND_SIZE) / 2,
          }}
        />
      </span>
    </button>
  );
}
