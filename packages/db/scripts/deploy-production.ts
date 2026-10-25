import { execSync } from "node:child_process";

/**
 * Tâche `deploy:production` de @app/db, lancée par le build de apps/web **après** `next build` :
 * sur Vercel, en production uniquement, applique les migrations (`prisma migrate deploy`). Ordre
 * voulu : si le build du site échoue, la base n'a pas bougé et la version en ligne reste cohérente ;
 * si une migration échoue, le build échoue et Vercel garde la version en ligne.
 * Partout ailleurs (local, CI, previews Vercel), rien n'est appliqué.
 *
 * Migration en échec enregistrée (erreur P3009 aux déploiements suivants) : corriger la migration
 * ou la base à la main, puis depuis un poste avec `DIRECT_URL` sur la prod :
 * `pnpm --filter @app/db exec prisma migrate resolve --rolled-back <nom_de_la_migration>` (ou
 * `--applied` si elle a en fait abouti), et relancer le déploiement.
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
