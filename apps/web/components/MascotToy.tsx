"use client";

import { useEffect, useState } from "react";
import { Mascot } from "./Mascot";

const JUMP_MS = 1000;

/** La mascotte dans le header : elle respire et cligne des yeux ; un clic la fait sauter de joie. */
export function MascotToy() {
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
      className="hover:bg-surface relative rounded-md p-1 transition-transform empty:hidden hover:scale-110"
    >
      <Mascot mood={jumping ? "victoire" : "repos"} height={40} className="block" />
    </button>
  );
}
