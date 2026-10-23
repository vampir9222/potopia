import { fileURLToPath } from "node:url";

/** Dossier des PNG sur le disque (scripts et tests ; l'app web lit sa copie dans `public/`). */
export const spritesDir = fileURLToPath(new URL("../sprites/", import.meta.url));
