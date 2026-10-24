import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Pas de .env (CI) : les variables viennent de l'environnement.
}

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
  },
});
