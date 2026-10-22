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
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      ADMIN_DISCORD_IDS: "100000000000000001",
      // Stockage local du docker-compose, bucket dédié aux tests.
      R2_ENDPOINT: process.env.R2_ENDPOINT || "http://localhost:9000",
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "localaccess",
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "localsecret",
      R2_BUCKET: "app-test",
    },
  },
});
