import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dbDir = fileURLToPath(new URL("..", import.meta.url));
const rootDir = join(dbDir, "..", "..");
const outDir = join(dbDir, "prisma", "schema");

/**
 * Prisma n'accepte qu'un dossier de schéma : on y copie `base.prisma` et le
 * `schema.prisma` de chaque module de `packages/*` et `games/*`, renommé `<dossier>.prisma`.
 */
export function assembleSchema(): string[] {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyFileSync(join(dbDir, "prisma", "base.prisma"), join(outDir, "base.prisma"));

  const copied: string[] = [];
  for (const group of ["packages", "games"]) {
    const groupDir = join(rootDir, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const source = join(groupDir, entry.name, "schema.prisma");
      if (!existsSync(source)) continue;
      const target = group === "games" ? `game-${entry.name}.prisma` : `${entry.name}.prisma`;
      copyFileSync(source, join(outDir, target));
      copied.push(`${group}/${entry.name}`);
    }
  }
  return copied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const copied = assembleSchema();
  console.log(`Schéma assemblé : base${copied.map((m) => ` + ${m}`).join("")}`);
}
