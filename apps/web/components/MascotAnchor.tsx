"use client";

import { useEffect, useRef } from "react";
import type { MascotMood } from "./Mascot";
import { MASCOT_STAGE_EMPTY, setMascotStage } from "./mascotStage";

/** Hauteur de la mascotte flottante (MascotToy) ; largeur au ratio du dessin (512 × 773). */
export const MASCOT_TOY_HEIGHT = 180;
const WIDTH = Math.round((MASCOT_TOY_HEIGHT * 512) / 773);

type Props = {
  mood?: MascotMood;
  /** On peut l'en décrocher en la faisant glisser (sinon elle y reste posée). */
  movable?: boolean;
  /** Elle lance des phrases au hasard dans une bulle. */
  chatty?: boolean;
};

/**
 * Place réservée à la mascotte flottante : tant que ce bloc est affiché, elle vient s'y poser et
 * prend l'humeur `mood` ; elle retourne dans son coin quand il disparaît.
 */
export function MascotAnchor({ mood = "repos", movable = false, chatty = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMascotStage({ anchor: ref.current, movable, chatty });
    return () => setMascotStage(MASCOT_STAGE_EMPTY);
  }, [movable, chatty]);

  useEffect(() => setMascotStage({ mood }), [mood]);

  return <div ref={ref} aria-hidden style={{ width: WIDTH, height: MASCOT_TOY_HEIGHT }} />;
}
