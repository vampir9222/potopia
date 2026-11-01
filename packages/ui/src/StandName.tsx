"use client";

import { useEffect, useState } from "react";

// Nom tiré par le membre, gardé sur l'appareil (le nom lui-même : la liste peut changer).
const KEY = "potopia:jojo-stand-name";

/**
 * Nom du Stand (fiche de Stand, thème JoJo) : un clic en tire un autre au hasard dans la liste, et
 * le choix est gardé sur l'appareil. Rendu d'abord avec le nom par défaut (même rendu serveur et client),
 * puis le choix gardé s'applique.
 */
export function StandName({ names, initial }: { names: string[]; initial: number }) {
  const [index, setIndex] = useState(initial);

  useEffect(() => {
    try {
      const saved = names.indexOf(window.localStorage.getItem(KEY) ?? "");
      if (saved >= 0) setIndex(saved);
    } catch {
      /* navigation privée : le nom par défaut reste */
    }
  }, [names]);

  const next = () => {
    // au hasard, mais jamais le même deux fois de suite
    const i = (index + 1 + Math.floor(Math.random() * (names.length - 1))) % names.length;
    setIndex(i);
    try {
      window.localStorage.setItem(KEY, names[i] ?? "");
    } catch {
      /* navigation privée : le choix ne survivra pas au rechargement */
    }
  };

  return (
    <button
      type="button"
      className="jojo-stand-name"
      onClick={next}
      title="Clic : un autre nom de Stand, au hasard"
    >
      {names[index] ?? names[0]}
    </button>
  );
}
