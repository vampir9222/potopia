import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Pas de .env (CI) : les variables viennent de l'environnement.
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    // Valeurs fictives : l'API Discord est entièrement simulée (@app/core/testing).
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0000",
      BETTER_AUTH_URL: "http://localhost:3000",
      DISCORD_CLIENT_ID: "000000000000000000",
      DISCORD_CLIENT_SECRET: "test-client-secret",
      DISCORD_GUILD_ID: "123456789012345678",
      ADMIN_DISCORD_IDS: "100000000000000001",
      // Stockage : seules des URLs présignées sont calculées, sans appel réseau.
      R2_ENDPOINT: "http://localhost:9000",
      R2_ACCESS_KEY_ID: "localaccess",
      R2_SECRET_ACCESS_KEY: "localsecret",
      R2_BUCKET: "app-test",
    },
  },
});
