"use client";

import { cx } from "@app/ui";
import { useEffect, useState } from "react";
import { Mascot } from "./Mascot";

const JUMP_MS = 1000;

/**
 * La mascotte cliquable, en bas à droite du cadre « Apps » de l'accueil (masquée sur petit écran) :
 * elle respire et cligne des yeux ; un clic la fait sauter de joie.
 */
export function MascotToy({ className }: { className?: string }) {
  const [jumping, setJumping] = useState(false);

  useEffect(() => {
    if (!jumping) return;
    const timer = window.setTimeout(() => setJumping(false), JUMP_MS);
    return () => window.clearTimeout(timer);
  }, [jumping]);

  return (
    <button
      type="button"
      onClick={() => setJumping(true)}
      aria-label="Mascotte"
      title="Mascotte"
      // sans image (rien d'envoyé encore), le bouton disparaît
      className={cx(
        "hidden shrink-0 transition-transform hover:scale-105 sm:not-empty:block",
        className,
      )}
    >
      <Mascot mood={jumping ? "victoire" : "repos"} height={180} className="block" />
    </button>
  );
}
