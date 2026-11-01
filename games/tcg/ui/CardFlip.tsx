"use client";

import { type MouseEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { CardBack } from "./CardBack";
import { Tilt } from "./Tilt";

/** Déplacement (px) au-delà duquel un appui devient un glisser : en dessous, c'est un clic. */
const DRAG_THRESHOLD = 6;

/**
 * Carte qu'on retourne en la faisant tourner : glisser à l'horizontale (souris ou doigt) la fait
 * pivoter, et au lâcher elle se pose sur la face la plus proche. Un clic sans glisser passe au
 * contenu (lien de la planche). Le dos n'est dessiné qu'au premier retournement.
 */
export function CardFlip({
  children,
  still = false,
  button = false,
}: {
  /** La face : une carte (`GameCard`), éventuellement dans un lien. */
  children: ReactNode;
  /** Planche de nombreuses cartes : dos sans inclinaison, galaxie figée. */
  still?: boolean;
  /** Bouton « Voir le dos » sous la carte (clavier, et pour qui ne pense pas à glisser). */
  button?: boolean;
}) {
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [backShown, setBackShown] = useState(false);
  const start = useRef<{ x: number; angle: number } | null>(null);
  const moved = useRef(false);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, angle };
    moved.current = false;
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!moved.current) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      // Capture seulement une fois le glisser lancé : un simple clic garde sa cible (le lien).
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      setBackShown(true);
    }
    // Toute la largeur de la carte = un demi-tour.
    const width = e.currentTarget.getBoundingClientRect().width || 300;
    setAngle(s.angle + (dx / width) * 180);
  }

  function up() {
    start.current = null;
    if (!dragging) return;
    setDragging(false);
    setAngle((a) => Math.round(a / 180) * 180);
  }

  // Un glisser ne doit pas ouvrir le lien de la carte.
  function click(e: MouseEvent<HTMLDivElement>) {
    if (!moved.current) return;
    moved.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  const backVisible = Math.round(angle / 180) % 2 !== 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="tcg-flip"
        data-dragging={dragging ? "" : undefined}
        style={{ transform: `perspective(1200px) rotateY(${angle.toFixed(2)}deg)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={click}
      >
        <div className="tcg-flip-face">{children}</div>
        <div className="tcg-flip-face tcg-flip-back">
          {backShown &&
            (still ? (
              <CardBack animated={false} />
            ) : (
              <Tilt radius={18}>
                <CardBack />
              </Tilt>
            ))}
        </div>
      </div>
      {button && (
        <button
          type="button"
          className="text-muted text-sm hover:underline"
          onClick={() => {
            setBackShown(true);
            setAngle((a) => Math.round(a / 180) * 180 + 180);
          }}
        >
          {backVisible ? "Voir la face" : "Voir le dos"}
        </button>
      )}
    </div>
  );
}
