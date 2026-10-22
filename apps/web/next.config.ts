import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Next ne lit que les .env de apps/web : on charge celui de la racine du monorepo (absent sur Vercel).
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // Pas de .env : les variables viennent de l'environnement.
}

const nextConfig: NextConfig = {
  // Les packages du monorepo exportent du TypeScript brut : Next les compile.
  transpilePackages: [
    "@app/config",
    "@app/core",
    "@app/db",
    "@app/economy",
    "@app/ideas",
    "@app/storage",
    "@app/ui",
  ],
  experimental: {
    // forbidden() → 403 sur les pages admin (convention forbidden.tsx).
    authInterrupts: true,
  },
};

export default nextConfig;
