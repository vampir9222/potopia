import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // La CI fournit les variables directement.
}

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
  },
});
