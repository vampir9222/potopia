"use client";

import { Button, cx } from "@app/ui";
import { useState, type CSSProperties } from "react";
import { EMERALDS, emeraldSrc, hasAllEmeralds, type EmeraldColor } from "../src/catalog";
import { playClip, SOUNDS } from "./sounds";
import { setEmeraldsDisabled, useEmeraldsDisabled } from "./superSonic";

/**
 * Disposition de l'image d'origine : six émeraudes en cercle autour de la bleue (position du
 * centre de chaque pierre, en % du cadre), et ordre de la vague quand le pouvoir change : de la
 * bleue du centre vers le cercle (libéré), et l'inverse (scellé).
 */
const LAYOUT: Record<EmeraldColor, { x: number; y: number; wave: number }> = {
  blue: { x: 50, y: 50, wave: 0 },
  yellow: { x: 50, y: 14, wave: 1 },
  white: { x: 80, y: 32, wave: 2 },
  green: { x: 80, y: 68, wave: 3 },
  purple: { x: 50, y: 86, wave: 4 },
  cyan: { x: 20, y: 68, wave: 5 },
  red: { x: 20, y: 32, wave: 6 },
};
// une vague serrée : chaque pierre démarre 45 ms après la précédente, elles se chevauchent
const WAVE_STEP_MS = 45;
const STONE_MS = 500;
const WAVE_MS = WAVE_STEP_MS * 6 + STONE_MS;

/**
 * Les 7 Émeraudes du Chaos de l'inventaire : en noir tant qu'elles ne sont pas trouvées. Réunies,
 * leur pouvoir (Super Sonic) peut être scellé : elles s'éteignent une à une et Sonic redevient
 * Sonic ; libéré, elles se rallument en vague depuis la bleue du centre. Un bruitage de Sonic 2
 * accompagne chaque bascule.
 */
export function EmeraldCircle({ items }: { items: readonly string[] }) {
  const sealed = useEmeraldsDisabled();
  const complete = hasAllEmeralds(items);
  const [wave, setWave] = useState<"seal" | "unseal" | null>(null);

  const toggle = () => {
    const next = !sealed;
    const sound = next ? SOUNDS.seal : SOUNDS.unseal;
    playClip(sound.src, sound.volume, 80);
    setWave(next ? "seal" : "unseal");
    setEmeraldsDisabled(next);
    window.setTimeout(() => setWave(null), WAVE_MS);
  };

  return (
    <>
      <div className="relative mx-auto aspect-[9/10] w-full max-w-72 select-none">
        {EMERALDS.map((e) => {
          const owned = items.includes(e.id);
          const { x, y, wave: order } = LAYOUT[e.color];
          // scellé : la vague repart du cercle extérieur et finit par la bleue
          const step = wave === "seal" ? 6 - order : order;
          const delay = wave ? step * WAVE_STEP_MS : 0;
          return (
            <img
              key={e.id}
              src={emeraldSrc(e.color)}
              alt={owned ? e.name : "Émeraude pas encore trouvée"}
              width={63}
              height={63}
              draggable={false}
              className={cx(
                "emerald-slot absolute w-[22%] -translate-1/2",
                !owned ? "emerald-locked" : complete && sealed ? "emerald-sealed" : "emerald-owned",
                owned && wave === "unseal" && "emerald-awaken",
                owned && wave === "seal" && "emerald-fade",
              )}
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  imageRendering: "pixelated",
                  animationDelay: `${delay}ms`,
                  "--stone-ms": `${STONE_MS}ms`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
      {complete && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" disabled={wave !== null} onClick={toggle}>
            {sealed ? "Libérer le pouvoir" : "Sceller le pouvoir"}
          </Button>
        </div>
      )}
    </>
  );
}
