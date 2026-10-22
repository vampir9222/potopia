import { fileURLToPath } from "node:url";

/** Charge le `.env` de la racine du monorepo s'il existe (absent en CI et sur Vercel). */
export function loadRootEnv(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
  } catch {
    // Pas de .env : les variables viennent de l'environnement.
  }
}
