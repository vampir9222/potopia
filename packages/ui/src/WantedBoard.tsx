"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Panneau d'affichage du thème One Piece : des avis de recherche punaisés, qui se chevauchent.
 * De temps en temps, l'affiche du dessus d'une pile se décroche et tombe, et laisse voir celle du
 * dessous ; elle repasse sous la pile, si bien que chaque emplacement fait défiler ses affiches à
 * l'infini. Position (en % du panneau), inclinaison, et la pile de chaque emplacement.
 */
const SLOTS = [
  { x: 3, y: 4, tilt: -4, posters: ["luffy", "ace", "shanks", "law", "whitebeard"] },
  { x: 35, y: 1, tilt: 3, posters: ["zoro", "kaido", "bigmom", "blackbeard"] },
  { x: 67, y: 6, tilt: -2, posters: ["nami", "buggy", "crocodile", "arlong"] },
  { x: 17, y: 45, tilt: 5, posters: ["sanji", "usopp", "chopper"] },
  { x: 51, y: 47, tilt: -6, posters: ["robin", "franky", "brook"] },
];

const FALL_MS = 1500;
const WAIT_MIN_MS = 4500;
const WAIT_MAX_MS = 9000;

const src = (name: string) => `/onepiece/wanted-${name}.webp`;

export function WantedBoard() {
  const [stacks, setStacks] = useState(() => SLOTS.map((s) => s.posters));
  const [falling, setFalling] = useState<number | null>(null);

  useEffect(() => {
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(
        () => {
          // seulement quand le thème est affiché (le décor existe pour tous les thèmes)
          if (document.documentElement.dataset.theme !== "onepiece" || document.hidden) {
            next();
            return;
          }
          const slot = Math.floor(Math.random() * SLOTS.length);
          setFalling(slot);
          timer = window.setTimeout(() => {
            setStacks((all) =>
              all.map((st, i) => (i === slot ? [...st.slice(1), ...st.slice(0, 1)] : st)),
            );
            setFalling(null);
            next();
          }, FALL_MS);
        },
        WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS),
      );
    };
    next();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="op-board">
      <span className="op-board-post op-board-post-left" />
      <span className="op-board-post op-board-post-right" />
      <div className="op-board-panel">
        {SLOTS.map((slot, i) =>
          // l'affiche du dessus et celle du dessous (les autres attendent leur tour)
          (stacks[i] ?? []).slice(0, 2).map((name, depth) => (
            <span
              key={`${i}-${name}`}
              className={`op-board-poster${depth === 0 && falling === i ? "op-board-falling" : ""}`}
              style={
                {
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  zIndex: 10 + i * 2 + (depth === 0 ? 1 : 0),
                  backgroundImage: `url(${src(name)})`,
                  "--poster-tilt": `${slot.tilt + (depth === 0 ? 0 : -slot.tilt * 0.6)}deg`,
                } as CSSProperties
              }
            />
          )),
        )}
      </div>
    </div>
  );
}
