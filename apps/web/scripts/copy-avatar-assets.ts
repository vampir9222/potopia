/**
 * Copie les sprites LPC de @app/avatar-assets dans public/avatar-assets (dossier généré, ignoré
 * par git) : le navigateur les charge pour l'aperçu de l'éditeur, le serveur pour composer les
 * planches. Lancé par la tâche `generate` avant dev, build, typecheck et test.
 */
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spritesDir } from "@app/avatar-assets/fs";

const target = fileURLToPath(new URL("../public/avatar-assets/", import.meta.url));
rmSync(target, { recursive: true, force: true });
cpSync(spritesDir, target, { recursive: true });
console.log("Sprites d'avatar copiés dans public/avatar-assets.");
