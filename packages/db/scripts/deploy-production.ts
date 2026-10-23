import { execSync } from "node:child_process";

/**
 * Tâche `build` de @app/db : sur Vercel, en production uniquement, applique les migrations
 * (`prisma migrate deploy`) avant que l'app ne soit construite. Une migration qui échoue fait
 * échouer le build : Vercel garde alors la version en ligne, jamais du code sans ses tables.
 * Partout ailleurs (local, CI, previews Vercel), rien n'est appliqué.
 */
if (process.env.VERCEL_ENV !== "production") {
  console.log("Migrations : pas en production Vercel, rien à appliquer.");
} else {
  // Même URL que prisma.config.ts : l'URL directe, le pooler de Neon ne convient pas à migrate.
  if (!process.env.DIRECT_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Migrations : ni DIRECT_URL ni DATABASE_URL_UNPOOLED dans l'environnement.");
  }
  // Le schéma vient d'être assemblé par la tâche `generate`, dont dépend `build`.
  execSync("prisma migrate deploy", { stdio: "inherit" });
}
