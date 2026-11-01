"use client";

import { DON_EVENT, effectiveVolume } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DON_MS = 1900;
// préchargé à l'ouverture du menu des thèmes (ThemeSwitcher de @app/ui) : il surgit au coup de
// tambour
const GEAR5 = "/onepiece/portrait-gear5.webp";
// nuages de vapeur de Gear 5, en couronne autour de lui (en % de l'écran), qui éclatent l'un
// après l'autre
const PUFFS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return {
    x: 50 + Math.cos(angle) * 30,
    y: 52 + Math.sin(angle) * 30,
    delay: 120 + i * 70,
    size: 80 + (i % 3) * 30,
  };
});
// Tambours de la Libération, le cœur de Nika : « ドン・ドッ・トッ・ト » (instant en s, volume, hauteur)
const BEATS = [
  { at: 0, gain: 1, pitch: 1 },
  { at: 0.3, gain: 0.7, pitch: 1.12 },
  { at: 0.44, gain: 0.55, pitch: 1.2 },
  { at: 0.58, gain: 0.5, pitch: 1.12 },
];
const VOLUME = 0.9;

/**
 * Coup de taiko synthétisé : un sinus grave dont la hauteur chute (le fût qui résonne) et un
 * bruit court filtré (la frappe sur la peau).
 */
function drum(ctx: AudioContext, t: number, volume: number, pitch: number) {
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);

  const body = ctx.createOscillator();
  body.frequency.setValueAtTime(150 * pitch, t);
  body.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.5);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(1, t + 0.006);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  body.connect(bodyGain).connect(out);
  body.start(t);
  body.stop(t + 1.3);

  const length = Math.floor(ctx.sampleRate * 0.15);
  const noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const hit = ctx.createBufferSource();
  hit.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  const hitGain = ctx.createGain();
  hitGain.gain.value = 0.7;
  hit.connect(filter).connect(hitGain).connect(out);
  hit.start(t);
}

/** Le rythme des Tambours de la Libération, sur un seul contexte audio. */
function drums(volume: number) {
  const ctx = new AudioContext();
  const t = ctx.currentTime + 0.01;
  for (const beat of BEATS) drum(ctx, t + beat.at, volume * beat.gain, beat.pitch);
  window.setTimeout(() => void ctx.close(), 2400);
}

/**
 * « ドン!! » façon manga (thème One Piece) : les Tambours de la Libération, flash, lignes de
 * vitesse noires qui convergent vers le centre et onomatopée qui claque en tremblant ; Luffy en
 * Gear 5 surgit derrière en riant, rebondit comme du caoutchouc dans une couronne de nuages de
 * vapeur, puis tout s'efface. Déclenché par `don()` de `@app/ui` (choix du thème One Piece).
 * Monté une fois, layout racine.
 */
export function Don() {
  const [on, setOn] = useState(false);
  const onRef = useRef(false);

  useEffect(() => {
    let timer = 0;
    const start = () => {
      if (onRef.current) return;
      onRef.current = true;
      setOn(true);
      const level = effectiveVolume() * VOLUME;
      if (level > 0) drums(level);
      timer = window.setTimeout(() => {
        onRef.current = false;
        setOn(false);
      }, DON_MS);
    };
    window.addEventListener(DON_EVENT, start);
    return () => {
      window.removeEventListener(DON_EVENT, start);
      window.clearTimeout(timer);
    };
  }, []);

  if (!on) return null;
  return createPortal(
    <div aria-hidden className="don-layer pointer-events-none fixed inset-0 z-100">
      <span className="don-flash" />
      <span className="don-lines" />
      {PUFFS.map((p, i) => (
        <span
          key={i}
          className="don-puff"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
      <span className="don-gear5" style={{ backgroundImage: `url(${GEAR5})` }} />
      <span className="don-text">
        <span>
          ドン<span className="don-bang">!!</span>
        </span>
      </span>
    </div>,
    document.body,
  );
}
