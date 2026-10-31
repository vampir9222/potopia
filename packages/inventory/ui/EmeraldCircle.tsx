"use client";

import { Button, cx } from "@app/ui";
import { useRef, useState, type CSSProperties } from "react";
import { EMERALDS, emeraldSrc, hasAllEmeralds, type EmeraldColor } from "../src/catalog";
import { playClip, playTink, SOUNDS } from "./sounds";
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

// couleur des éclats qui jaillissent d'une pierre quand on tape dessus
const SPARK_COLORS: Record<EmeraldColor, string> = {
  blue: "#5aa8ff",
  yellow: "#ffe14a",
  white: "#f4f4ff",
  green: "#4fe07a",
  purple: "#c47bff",
  cyan: "#5ff0f0",
  red: "#ff5a5a",
};
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Un coup sur une pierre trouvée : elle sursaute en penchant d'un côté, s'illumine et lâche
 * quelques éclats de sa couleur. Sens, angle, hauteur, durée, nombre et trajectoire des éclats sont
 * tirés au hasard à chaque coup : deux coups se ressemblent sans jamais être identiques.
 */
function tap(stone: HTMLElement, layer: HTMLElement, color: EmeraldColor) {
  for (const a of stone.getAnimations()) if (a.id === "tap") a.cancel();
  const tilt = (Math.random() < 0.5 ? -1 : 1) * rand(5, 14);
  const pop = rand(1.08, 1.2);
  const lift = rand(2, 7);
  const duration = rand(360, 480);
  stone.animate(
    [
      { transform: "none" },
      { transform: `translateY(${-lift}px) rotate(${tilt}deg) scale(${pop})`, offset: 0.28 },
      { transform: `rotate(${-tilt * 0.35}deg) scale(${2 - pop})`, offset: 0.62 },
      { transform: "none" },
    ],
    { duration, easing: "ease-out", id: "tap" },
  );
  // éclat blanc qui retombe sur la brillance de la pierre (mêmes fonctions de filtre que le CSS)
  stone.animate(
    [
      {
        filter: `grayscale(0) brightness(${rand(1.5, 2)}) drop-shadow(0 0 12px rgb(255 255 255 / 0.9))`,
      },
    ],
    { duration: duration * 0.8, easing: "ease-out", id: "tap" },
  );
  const count = 3 + Math.floor(Math.random() * 4);
  const start = rand(0, Math.PI * 2);
  for (let i = 0; i < count; i++) {
    const spark = document.createElement("span");
    spark.className = "emerald-tap-spark";
    spark.style.left = stone.style.left;
    spark.style.top = stone.style.top;
    spark.style.background = SPARK_COLORS[color];
    layer.append(spark);
    const angle = start + (i / count) * Math.PI * 2 + rand(-0.4, 0.4);
    const dist = rand(18, 34);
    const size = rand(0.6, 1.2);
    spark
      .animate(
        [
          { transform: `translate(-50%, -50%) rotate(45deg) scale(${size})`, opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) rotate(45deg) scale(0)`,
            opacity: 0.6,
          },
        ],
        { duration: rand(380, 560), easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      )
      .finished.finally(() => spark.remove());
  }
  playTink();
}

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
  const layerRef = useRef<HTMLDivElement>(null);

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
      <div ref={layerRef} className="relative mx-auto aspect-[9/10] w-full max-w-72 select-none">
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
              alt={owned ? e.name : "Chaos Emerald pas encore trouvée"}
              width={63}
              height={63}
              draggable={false}
              onClick={
                owned
                  ? (ev) => {
                      if (!wave && layerRef.current)
                        tap(ev.currentTarget, layerRef.current, e.color);
                    }
                  : undefined
              }
              className={cx(
                "emerald-slot absolute w-[22%] -translate-1/2",
                owned && "cursor-pointer",
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
