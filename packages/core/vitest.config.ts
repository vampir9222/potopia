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
    // Une seule base de test partagée : les fichiers ne doivent pas tourner en parallèle.
    fileParallelism: false,
    // Valeurs fictives : l'API Discord est entièrement simulée (test/fake-discord.ts).
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0000",
      BETTER_AUTH_URL: "http://localhost:3000",
      DISCORD_CLIENT_ID: "000000000000000000",
      DISCORD_CLIENT_SECRET: "test-client-secret",
      DISCORD_GUILD_ID: "123456789012345678",
      ADMIN_DISCORD_IDS: "100000000000000001",
      // Stockage local du docker-compose (planches d'avatar), bucket dédié aux tests.
      R2_ENDPOINT: process.env.R2_ENDPOINT || "http://localhost:9000",
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "localaccess",
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "localsecret",
      R2_BUCKET: "app-test",
    },
  },
});
