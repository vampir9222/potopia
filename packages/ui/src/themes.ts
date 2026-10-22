/**
 * Thèmes proposés aux membres. Chaque `id` correspond à un bloc [data-theme="…"] de theme.css ;
 * `swatch` est la couleur (ou le dégradé CSS) de la pastille du sélecteur.
 * Le choix est mémorisé par appareil dans un cookie, lu par l'app au rendu serveur (pas de flash).
 */
export const THEMES = [
  { id: "fantasy", label: "Fantasy", swatch: "#e6b04e" },
  { id: "classic", label: "Classique", swatch: "#7c8cff" },
  {
    id: "rgb",
    label: "RGB",
    swatch: "conic-gradient(#ff0040, #ffee00, #00ff6a, #00d0ff, #c000ff, #ff0040)",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "fantasy";
export const THEME_COOKIE = "theme";

/** Thème valide à partir d'une valeur quelconque (cookie absent ou périmé → thème par défaut). */
export function resolveTheme(value: string | undefined | null): ThemeId {
  return THEMES.find((t) => t.id === value)?.id ?? DEFAULT_THEME;
}
