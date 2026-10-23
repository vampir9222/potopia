import catalogJson from "../data/catalog.json";
import palettesJson from "../data/palettes.json";
import type { Catalog, Palettes } from "./types";

export * from "./types";

/** Catalogue généré par `pnpm assets:import` (sans les crédits, pour rester léger côté client). */
export const catalog = catalogJson as unknown as Catalog;
export const palettes = palettesJson as unknown as Palettes;

/** Chemin d'un PNG, relatif au dossier `sprites/` (et à `/avatar-assets/` côté navigateur). */
export function spriteFile(dir: string, animation: string): string {
  return `${dir}${animation}.png`;
}
