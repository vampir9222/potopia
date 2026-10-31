"use client";

import { DON_EVENT, effectiveVolume } from "@app/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DON_MS = 1600;
const VOLUME = 0.9;

/**
 * Coup de taiko synthétisé : un sinus grave dont la hauteur chute (le fût qui résonne) et un
 * bruit court filtré (la frappe sur la peau).
 */
function drum(volume: number) {
  const ctx = new AudioContext();
  const t = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(ctx.destination);

  const body = ctx.createOscillator();
  body.frequency.setValueAtTime(150, t);
  body.frequency.exponentialRampToValueAtTime(48, t + 0.5);
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

  window.setTimeout(() => void ctx.close(), 1600);
}

/**
 * « ドン!! » façon manga (thème One Piece) : coup de tambour, flash, lignes de vitesse noires qui
 * convergent vers le centre et onomatopée qui claque en tremblant, puis tout s'efface. Déclenché
 * par `don()` de `@app/ui` (choix du thème One Piece). Monté une fois, layout racine.
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
      if (level > 0) drum(level);
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
      <span className="don-text">
        <span>
          ドン<span className="don-bang">!!</span>
        </span>
      </span>
    </div>,
    document.body,
  );
}
