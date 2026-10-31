"use client";

import { useRef } from "react";
import { DEFAULT_FRAME, FRAME_ZOOM, type ImageFrame } from "../src/card-rules";
import { frameStyle } from "./cards";

type Props = {
  imageUrl: string;
  frame: ImageFrame;
  onChange: (frame: ImageFrame) => void;
  /** Taille de la fenêtre d'illustration montrée (proportions de la carte normale ou full art). */
  width: number;
  height: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Cadrage d'une illustration : on fait glisser l'image dans la fenêtre pour choisir ce qui se voit,
 * et on zoome avec le curseur. L'image elle-même n'est pas rognée.
 */
export function ImageFramer({ imageUrl, frame, onChange, width, height }: Props) {
  const drag = useRef<{ x: number; y: number; frame: ImageFrame } | null>(null);

  function move(clientX: number, clientY: number) {
    const start = drag.current;
    if (!start) return;
    // Glisser l'image vers la droite montre sa partie gauche : le point visé recule.
    const dx = ((clientX - start.x) / width) * (100 / start.frame.zoom);
    const dy = ((clientY - start.y) / height) * (100 / start.frame.zoom);
    onChange({
      ...start.frame,
      x: Math.round(clamp(start.frame.x - dx, 0, 100) * 10) / 10,
      y: Math.round(clamp(start.frame.y - dy, 0, 100) * 10) / 10,
    });
  }

  function zoom(value: number) {
    onChange({
      ...frame,
      zoom: Math.round(clamp(value, FRAME_ZOOM.min, FRAME_ZOOM.max) * 100) / 100,
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="application"
        aria-label="Cadrage de l'illustration : glisser pour déplacer"
        className="border-border cursor-grab touch-none overflow-hidden rounded-lg border active:cursor-grabbing"
        style={{ width, height }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, frame };
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none block size-full select-none"
          style={{ objectFit: "cover", ...frameStyle(frame) }}
        />
      </div>
      <div className="flex w-full items-center gap-2 text-sm" style={{ maxWidth: width }}>
        <label className="text-muted flex flex-1 items-center gap-2">
          Zoom
          <input
            type="range"
            min={FRAME_ZOOM.min}
            max={FRAME_ZOOM.max}
            step={0.05}
            value={frame.zoom}
            onChange={(e) => zoom(Number(e.target.value))}
            className="flex-1"
          />
        </label>
        <button
          type="button"
          className="text-accent underline-offset-4 hover:underline"
          onClick={() => onChange(DEFAULT_FRAME)}
        >
          Recentrer
        </button>
      </div>
    </div>
  );
}
