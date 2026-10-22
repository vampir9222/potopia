import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pas d'import de scripts/env : la config Vite native refuse les imports sans extension.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Pas de .env (CI) : les variables viennent de l'environnement.
}

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Les tests ne touchent que la base de test : `db` pointe dessus.
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
  },
});
