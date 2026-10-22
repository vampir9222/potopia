/**
 * Thèmes proposés aux membres. Chaque `id` correspond à un bloc [data-theme="…"] de theme.css.
 * Le choix est mémorisé par appareil dans un cookie, lu par l'app au rendu serveur (pas de flash).
 */
export const THEMES = [
  { id: "fantasy", label: "Fantasy", swatch: "#e6b04e" },
  { id: "classic", label: "Classique", swatch: "#7c8cff" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "fantasy";
export const THEME_COOKIE = "theme";

/** Thème valide à partir d'une valeur quelconque (cookie absent ou périmé → thème par défaut). */
export function resolveTheme(value: string | undefined | null): ThemeId {
  return THEMES.find((t) => t.id === value)?.id ?? DEFAULT_THEME;
}
