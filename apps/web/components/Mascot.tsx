"use client";

// <img> et non next/image : l'optimiseur de Next irait chercher l'image sans les cookies du membre
// (la route répond 401) ; elle est de toute façon petite et gardée en cache par le navigateur.
/* eslint-disable @next/next/no-img-element */

import { cx } from "@app/ui";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

export type MascotMood = "repos" | "victoire" | "chargement" | "erreur" | "perdu";

/** Corps 512 × 673 px, couronne 100 px au-dessus : 773 px de haut en tout (styles dans globals.css). */
const FULL_HEIGHT = 773;

type Props = {
  mood?: MascotMood;
  /** Hauteur affichée en px, couronne comprise. */
  height: number;
  /** Affiché à la place si les images manquent (visiteur non connecté, rien d'envoyé encore). */
  fallback?: ReactNode;
  className?: string;
};

/**
 * La mascotte animée : respiration et clignement au repos, saut en victoire, rebonds pendant un
 * chargement, affaissée sur une erreur, perplexe sur une page introuvable. Purement décorative.
 */
export function Mascot({ mood = "repos", height, fallback = null, className }: Props) {
  const [broken, setBroken] = useState(false);
  const bodyRef = useRef<HTMLImageElement>(null);

  // L'image a pu échouer avant l'hydratation (onError jamais reçu) : on vérifie au montage.
  useEffect(() => {
    const img = bodyRef.current;
    if (img?.complete && img.naturalWidth === 0) setBroken(true);
  }, []);

  if (broken) return fallback;
  return (
    <span
      aria-hidden
      className={cx("mascot", `mascot-${mood}`, className)}
      style={{ "--s": height / FULL_HEIGHT } as CSSProperties}
    >
      <span className="mascot-all">
        <img
          ref={bodyRef}
          src="/api/mascotte/corps"
          alt=""
          draggable={false}
          className="mascot-body"
          onError={() => setBroken(true)}
        />
        <span className="mascot-lid mascot-lid-l" />
        <span className="mascot-lid mascot-lid-r" />
        <img src="/api/mascotte/couronne" alt="" draggable={false} className="mascot-crown" />
      </span>
    </span>
  );
}
