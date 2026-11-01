"use client";

import { useEffect, useState } from "react";

// Nom choisi par le membre, gardé sur l'appareil (rang dans la liste des noms possibles).
const KEY = "potopia:jojo-stand-name";

/**
 * Nom du Stand (fiche de Stand, thème JoJo) : un clic passe au nom suivant de la liste, et le choix
 * est gardé sur l'appareil. Rendu d'abord avec le nom par défaut (même rendu serveur et client),
 * puis le choix gardé s'applique.
 */
export function StandName({ names, initial }: { names: string[]; initial: number }) {
  const [index, setIndex] = useState(initial);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(KEY));
      if (window.localStorage.getItem(KEY) !== null && saved >= 0 && saved < names.length) {
        setIndex(saved);
      }
    } catch {
      /* navigation privée : le nom par défaut reste */
    }
  }, [names.length]);

  const next = () => {
    const i = (index + 1) % names.length;
    setIndex(i);
    try {
      window.localStorage.setItem(KEY, String(i));
    } catch {
      /* navigation privée : le choix ne survivra pas au rechargement */
    }
  };

  return (
    <button
      type="button"
      className="jojo-stand-name"
      onClick={next}
      title="Clic : un autre nom de Stand"
    >
      {names[index] ?? names[0]}
    </button>
  );
}
