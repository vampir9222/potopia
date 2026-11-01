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
    "@app/agents",
    "@app/avatar",
    "@app/avatar-assets",
    "@app/config",
    "@app/core",
    "@app/db",
    "@app/economy",
    "@app/ideas",
    "@app/inventory",
    "@app/storage",
    "@app/tcg",
    "@app/trois",
    "@app/ui",
  ],
  // Composition des planches d'avatar côté serveur : les sprites de public/ (servis par le CDN)
  // doivent aussi être embarqués dans les fonctions.
  outputFileTracingIncludes: { "/**": ["./public/avatar-assets/**/*"] },
  // Images, vidéos et sons des thèmes et du header (public/, hors du proxy) : gardés un jour par
  // le navigateur, puis revalidés en fond pendant une semaine, au lieu d'une revalidation à chaque
  // page. Un fichier modifié garde donc son ancienne version un jour au plus : changer son nom
  // pour un effet immédiat.
  async headers() {
    return [
      {
        source: "/:dir(apothicaire|audio|emeralds|jojo|luffy|onepiece|orb|sonic)/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  experimental: {
    // forbidden() → 403 sur les pages admin (convention forbidden.tsx).
    authInterrupts: true,
  },
};

export default nextConfig;
