import { loadRootEnv } from "./scripts/env";
import { defineConfig } from "prisma/config";

loadRootEnv();

export default defineConfig({
  // Dossier généré par scripts/assemble.ts (base.prisma + schémas des modules).
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Les migrations passent par l'URL directe : le pooler de Neon ne supporte pas
    // tout ce dont `migrate` a besoin. DATABASE_URL_UNPOOLED est le nom que lui donne
    // l'intégration Neon de Vercel. `generate` n'a pas besoin d'URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || "",
  },
});
