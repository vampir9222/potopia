"use client";

import { isTimeStopped, timeNow } from "@app/ui";

// Confettis sur un canvas temporaire, qui se retire tout seul à la fin.

const COLORS = ["#16a34a", "#f59e0b", "#f4f4f5", "#22c55e", "#fbbf24", "#60a5fa", "#f472b6"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
};

/** `big` : 3 sur 3, pluie depuis les deux côtés ; sinon petite gerbe depuis le centre de l'écran. */
export function confetti({ big = false } = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "60",
  });
  const c = canvas.getContext("2d");
  if (!c) return;
  document.body.appendChild(canvas);
  c.scale(dpr, dpr);

  const piece = (x: number, y: number, angle: number, speed: number): Piece => ({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    color: COLORS[(Math.random() * COLORS.length) | 0] ?? "#ffffff",
  });

  const pieces: Piece[] = [];
  if (big) {
    // deux canons dans les coins bas, tirés vers le centre
    for (let i = 0; i < 90; i++) {
      pieces.push(piece(0, H, -Math.PI / 3 + (Math.random() - 0.5) * 0.6, 14 + Math.random() * 10));
      pieces.push(
        piece(W, H, (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.6, 14 + Math.random() * 10),
      );
    }
  } else {
    for (let i = 0; i < 60; i++) {
      pieces.push(piece(W / 2, H * 0.4, Math.random() * Math.PI * 2, 4 + Math.random() * 8));
    }
  }

  // horloge commune : « ZA WARUDO » (thème JoJo) fige les confettis en plein vol
  const start = timeNow();
  const duration = big ? 4500 : 2200;
  const frame = () => {
    if (isTimeStopped()) return void requestAnimationFrame(frame);
    const t = timeNow() - start;
    c.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vy += 0.25;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      c.save();
      c.globalAlpha = Math.max(0, 1 - t / duration);
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      // effet de rotation 3D : la largeur oscille
      c.fillRect(-p.w / 2, -p.h / 2, p.w * Math.cos(p.rot * 2), p.h);
      c.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
