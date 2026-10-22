import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Règle 1 du projet : un module ne lit ni n'écrit les tables d'un autre, il appelle ses fonctions.
 * Ce script lit les schema.prisma pour savoir à quel module appartient chaque modèle (et schéma
 * Postgres), puis signale dans le code de chaque module :
 * - un accès Prisma `<client>.<modèle>` à un modèle d'un autre module ;
 * - du SQL brut visant `"<schéma>"."<table>"` d'un autre module ;
 * et, dans apps/*, tout import de @app/db (les apps passent par les fonctions des modules).
 * Les tests (dossiers test/) sont exclus : ils préparent leurs données directement.
 */

export type Domain = {
  /** Dossier du module, relatif à la racine (`packages/core`, `games/trois`). */
  dir: string;
  /** Délégués Prisma des modèles du module (`user`, `troisGame`…). */
  delegates: Set<string>;
  /** Schémas Postgres du module (`core`…). */
  schemas: Set<string>;
};

export type SourceFile = { path: string; content: string };
export type Violation = { path: string; line: number; message: string };

/** Modèles et schémas déclarés dans un schema.prisma. */
export function parseSchema(prisma: string): { delegates: Set<string>; schemas: Set<string> } {
  const delegates = new Set<string>();
  for (const [, name] of prisma.matchAll(/^model\s+(\w+)\s*\{/gm)) {
    if (name) delegates.add(name.charAt(0).toLowerCase() + name.slice(1));
  }
  const schemas = new Set<string>();
  for (const [, schema] of prisma.matchAll(/@@schema\("(\w+)"\)/g)) if (schema) schemas.add(schema);
  return { delegates, schemas };
}

// Méthodes des délégués Prisma : `(opts?.tx ?? db).notification.create(…)` est reconnu même sans
// nom de client devant.
const METHODS =
  "findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy";
const DELEGATE_CALL = new RegExp(`\\.(\\w+)\\.(?:${METHODS})\\b`, "g");
const CLIENT_ACCESS = /\b(?:db|tx|client|prisma)\.(\w+)\b/g;
const RAW_TABLE = /"(\w+)"\."\w+"/g;

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

export function findViolations(domains: Domain[], files: SourceFile[]): Violation[] {
  const delegateOwner = new Map<string, Domain>();
  const schemaOwner = new Map<string, Domain>();
  for (const d of domains) {
    for (const delegate of d.delegates) delegateOwner.set(delegate, d);
    for (const schema of d.schemas) schemaOwner.set(schema, d);
  }

  const violations: Violation[] = [];
  for (const file of files) {
    const own = domains.find((d) => file.path.startsWith(`${d.dir}/`));
    const report = (index: number, message: string) =>
      violations.push({ path: file.path, line: lineOf(file.content, index), message });

    if (file.path.startsWith("apps/")) {
      for (const m of file.content.matchAll(/from\s+"@app\/db"/g)) {
        report(m.index, "une app n'accède pas à la base : passer par les fonctions des modules");
      }
      continue;
    }

    const seen = new Set<number>();
    for (const pattern of [DELEGATE_CALL, CLIENT_ACCESS]) {
      for (const m of file.content.matchAll(pattern)) {
        const delegate = m[1] ?? "";
        const owner = delegateOwner.get(delegate);
        const at = m.index + m[0].indexOf(delegate);
        if (!owner || owner === own || seen.has(at)) continue;
        seen.add(at);
        report(at, `modèle « ${delegate} » du module ${owner.dir}`);
      }
    }
    for (const m of file.content.matchAll(RAW_TABLE)) {
      const owner = schemaOwner.get(m[1] ?? "");
      if (owner && owner !== own) report(m.index, `table ${m[0]} du module ${owner.dir}`);
    }
  }
  return violations;
}

const SOURCE = /\.(ts|tsx)$/;
const SKIP = new Set(["node_modules", "test", "generated", ".next", ".turbo", "dist"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (SOURCE.test(entry) && !entry.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

function main(): void {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const rel = (p: string) => relative(root, p).split("\\").join("/");

  const domains: Domain[] = [];
  const files: SourceFile[] = [];
  for (const group of ["packages", "games", "apps"]) {
    const groupDir = join(root, group);
    if (!existsSync(groupDir)) continue;
    for (const name of readdirSync(groupDir)) {
      const dir = join(groupDir, name);
      // packages/db : client partagé, assemblage et outils de test, hors domaine.
      if (!statSync(dir).isDirectory() || rel(dir) === "packages/db") continue;
      const schemaPath = join(dir, "schema.prisma");
      if (existsSync(schemaPath)) {
        domains.push({ dir: rel(dir), ...parseSchema(readFileSync(schemaPath, "utf8")) });
      }
      for (const path of walk(dir))
        files.push({ path: rel(path), content: readFileSync(path, "utf8") });
    }
  }

  const violations = findViolations(domains, files);
  for (const v of violations) console.error(`${v.path}:${v.line}  ${v.message}`);
  if (violations.length > 0) {
    console.error(`\n${violations.length} accès hors frontière.`);
    process.exit(1);
  }
  console.log(
    `Frontières respectées : ${domains.length} modules (${domains.map((d) => d.dir).join(", ")}), ${files.length} fichiers.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
