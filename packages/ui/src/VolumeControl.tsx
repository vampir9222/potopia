"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setVolume, useVolume } from "./volume";

/**
 * Bouton volume (header) qui ouvre un curseur : il règle le volume de tous les sons du site
 * (musique, jeux). Le réglage est mémorisé sur l'appareil.
 */
export function VolumeControl() {
  const { level, muted } = useVolume();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const percent = Math.round(level * 100);
  const silent = muted || percent === 0;
  const Icon = silent ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Régler le volume"
        aria-expanded={open}
        title="Volume"
        className="text-muted hover:bg-surface hover:text-text rounded-md p-2"
      >
        <Icon size={20} />
      </button>
      {open && (
        <div className="theme-frame rounded-theme animate-rise absolute right-0 mt-2 w-56 p-3 shadow-2xl">
          <div className="flex items-center justify-between pb-2 text-xs">
            <p className="text-muted">Volume</p>
            <span className="text-muted tabular-nums">{muted ? "Coupé" : `${percent} %`}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVolume({ muted: !muted })}
              aria-label={muted ? "Remettre le son" : "Couper le son"}
              aria-pressed={muted}
              title={muted ? "Remettre le son" : "Couper le son"}
              className="text-muted hover:bg-surface-hover hover:text-text rounded-md p-1.5"
            >
              {silent ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : percent}
              onChange={(e) => setVolume({ level: Number(e.target.value) / 100, muted: false })}
              aria-label="Volume"
              className="accent-accent h-1.5 flex-1 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
