"use client";

import { Check, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { THEME_COOKIE, THEMES, type ThemeId } from "./themes";
import { don } from "./don";
import { zaWarudo } from "./zaWarudo";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Bouton palette (header) qui ouvre la liste des thèmes. Le changement est immédiat (attribut
 * data-theme de <html>) et mémorisé sur l'appareil.
 */
export function ThemeSwitcher({ current }: { current: ThemeId }) {
  const [theme, setTheme] = useState(current);
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

  function choose(id: ThemeId) {
    // thème JoJo (choisi ou cliqué de nouveau) : « ZA WARUDO ! », le temps s'arrête jusqu'au clic
    if (id === "jojo") zaWarudo();
    // passer au thème One Piece : « ドン!! », coup de tambour et onomatopée de manga
    if (id === "onepiece" && theme !== "onepiece") don();
    setTheme(id);
    setOpen(false);
    document.documentElement.dataset.theme = id;
    document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Changer de thème"
        aria-expanded={open}
        title="Thème"
        className="text-muted hover:bg-surface hover:text-text rounded-md p-2"
      >
        <Palette size={20} />
      </button>
      {open && (
        <div className="theme-frame rounded-theme animate-rise absolute right-0 mt-2 w-44 p-1.5 shadow-2xl">
          <p className="text-muted px-2 pt-1 pb-1.5 text-xs">Thème</p>
          <ul>
            {THEMES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => choose(t.id)}
                  aria-pressed={theme === t.id}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    theme === t.id
                      ? "bg-accent/10 text-text"
                      : "text-muted hover:bg-surface-hover hover:text-text",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-3 rounded-full"
                    style={{ background: t.swatch }}
                  />
                  <span className="flex-1">{t.label}</span>
                  {theme === t.id && <Check size={14} className="text-accent" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
