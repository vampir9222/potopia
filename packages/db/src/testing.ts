import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { assembleSchema } from "../scripts/assemble";
import { createDb } from "./index";

const dbDir = fileURLToPath(new URL("..", import.meta.url));

/** URL de la base de test. Refuse toute base dont le nom ne finit pas par `_test`. */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL n'est pas définie.");
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`Refus de vider la base « ${name} » : son nom doit finir par _test.`);
  }
  return url;
}

/** Applique les migrations sur la base de test (`prisma migrate deploy`). */
export function migrateTestDb(): void {
  const url = getTestDatabaseUrl();
  assembleSchema();
  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbDir,
    env: { ...process.env, DIRECT_URL: url },
    stdio: "pipe",
  });
}

/** Vide toutes les tables des schémas de domaine (tout sauf `public`, où vit l'historique des migrations). */
export async function truncateTestDb(): Promise<void> {
  const db = createDb(getTestDatabaseUrl());
  try {
    const tables = await db.$queryRaw<{ schemaname: string; tablename: string }[]>`
      SELECT schemaname, tablename FROM pg_tables
      WHERE schemaname NOT IN ('public', 'pg_catalog', 'information_schema')`;
    if (tables.length === 0) return;
    const list = tables.map((t) => `"${t.schemaname}"."${t.tablename}"`).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await db.$disconnect();
  }
}

/** Applique les migrations sur `TEST_DATABASE_URL` puis vide les tables. */
export async function resetTestDb(): Promise<void> {
  migrateTestDb();
  await truncateTestDb();
}
