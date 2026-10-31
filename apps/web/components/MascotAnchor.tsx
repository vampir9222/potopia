"use client";

import { useEffect, useRef } from "react";
import type { MascotMood } from "./Mascot";
import { setMascotStage } from "./mascotStage";

/** Hauteur de la mascotte flottante (MascotToy) ; largeur au ratio du dessin (512 × 773). */
export const MASCOT_TOY_HEIGHT = 180;
const WIDTH = Math.round((MASCOT_TOY_HEIGHT * 512) / 773);

/**
 * Place réservée à la mascotte flottante : tant que ce bloc est affiché, elle vient s'y poser et
 * prend l'humeur `mood` ; elle retourne dans son coin quand il disparaît.
 */
export function MascotAnchor({ mood }: { mood: MascotMood }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMascotStage({ anchor: ref.current });
    return () => setMascotStage({ anchor: null, mood: null });
  }, []);

  useEffect(() => setMascotStage({ mood }), [mood]);

  return <div ref={ref} aria-hidden style={{ width: WIDTH, height: MASCOT_TOY_HEIGHT }} />;
}
