import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Règle 1 du projet : un module ne lit ni n'écrit les tables d'un autre, il appelle ses fonctions.
 * Ce script lit les schema.prisma pour savoir à quel module appartient chaque modèle (et schéma
 * Postgres), puis signale dans le code de chaque module :
 * - un accès Prisma `<client>.<modèle>.<méthode>(…)` à un modèle d'un autre module, quel que soit
 *   le nom du client (`db`, `tx`, `t`, `(opts?.tx ?? db)`…) et la méthode ;
 * - un délégué d'un autre module destructuré (`const { wallet } = tx`) ;
 * - un type Prisma d'un modèle d'un autre module (`Prisma.WalletWhereInput`, `Prisma.UserGetPayload`) ;
 * - du SQL brut visant une table d'un autre module (`"economy"."wallets"`, `economy.wallets`) ;
 * et, dans apps/*, tout import de @app/db (statique ou dynamique, `@app/db/testing` compris) : les
 * apps passent par les fonctions des modules.
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

// `<quelque chose>.<délégué>.<méthode>(` : le client peut être un identifiant quelconque ou une
// expression entre parenthèses (`(opts?.tx ?? db).notification.create(…)`), la méthode n'importe
// laquelle (`findRaw`, `updateManyAndReturn`…).
const DELEGATE_CALL = /[\w$)\]]\s*\.\s*(\w+)\s*\.\s*\w+\s*\(/g;
// `const { wallet, user: u } = tx` : délégués pris par destructuration d'un client.
const DESTRUCTURING = /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?!await\b)[\w$]+\s*;/g;
// `Prisma.WalletWhereInput`, `Prisma.UserGetPayload<…>` : construit à partir des modèles connus.
const PRISMA_TYPE = /\bPrisma\s*\.\s*([A-Z]\w*)/g;
// Types génériques de Prisma dont le nom commence comme un modèle (`Transaction`).
const PRISMA_GENERIC_TYPES = new Set(["TransactionClient", "TransactionIsolationLevel"]);
// `"economy"."wallets"` où que ce soit, et `FROM economy.wallets` / `"economy".wallets` /
// `economy."wallets"` après un mot-clé SQL qui introduit une table.
const RAW_TABLE_QUOTED = /"(\w+)"\."\w+"/g;
const RAW_TABLE_KEYWORD = /\b(?:from|join|into|update|table|truncate|only)\s+"?(\w+)"?\."?\w+"?/gi;
// Dans apps/* : `from "@app/db"`, `from "@app/db/testing"`, `import("@app/db")`, `require("@app/db")`.
const DB_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']@app\/db(?:\/[^"']*)?["']/g;

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/** Modèle (PascalCase) au début d'un nom de type Prisma, le plus long d'abord. */
function modelOfType(typeName: string, models: string[]): string | undefined {
  if (PRISMA_GENERIC_TYPES.has(typeName)) return undefined;
  return models.find((model) => typeName.startsWith(model) && typeName.length > model.length);
}

export function findViolations(domains: Domain[], files: SourceFile[]): Violation[] {
  const delegateOwner = new Map<string, Domain>();
  const schemaOwner = new Map<string, Domain>();
  for (const d of domains) {
    for (const delegate of d.delegates) delegateOwner.set(delegate, d);
    for (const schema of d.schemas) schemaOwner.set(schema, d);
  }
  const models = [...delegateOwner.keys()]
    .map((delegate) => delegate.charAt(0).toUpperCase() + delegate.slice(1))
    .sort((a, b) => b.length - a.length);
  const delegateOf = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

  const violations: Violation[] = [];
  for (const file of files) {
    const own = domains.find((d) => file.path.startsWith(`${d.dir}/`));
    const report = (index: number, message: string) =>
      violations.push({ path: file.path, line: lineOf(file.content, index), message });

    if (file.path.startsWith("apps/")) {
      for (const m of file.content.matchAll(DB_IMPORT)) {
        report(m.index, "une app n'accède pas à la base : passer par les fonctions des modules");
      }
      continue;
    }

    const seen = new Set<number>();
    const reportDelegate = (delegate: string, at: number) => {
      const owner = delegateOwner.get(delegate);
      if (!owner || owner === own || seen.has(at)) return;
      seen.add(at);
      report(at, `modèle « ${delegate} » du module ${owner.dir}`);
    };

    for (const m of file.content.matchAll(DELEGATE_CALL)) {
      const delegate = m[1] ?? "";
      reportDelegate(delegate, m.index + m[0].indexOf(delegate));
    }
    for (const m of file.content.matchAll(DESTRUCTURING)) {
      const inner = m[1] ?? "";
      const start = m.index + m[0].indexOf(inner);
      for (const prop of inner.matchAll(/(\w+)\s*(?::[^,]*)?(?:,|$)/g)) {
        if (prop[1]) reportDelegate(prop[1], start + prop.index);
      }
    }
    for (const m of file.content.matchAll(PRISMA_TYPE)) {
      const typeName = m[1] ?? "";
      const model = modelOfType(typeName, models);
      if (!model) continue;
      const owner = delegateOwner.get(delegateOf(model));
      if (!owner || owner === own) continue;
      report(
        m.index,
        `type Prisma.${typeName} du modèle « ${delegateOf(model)} » du module ${owner.dir}`,
      );
    }

    const seenTables = new Set<number>();
    for (const pattern of [RAW_TABLE_QUOTED, RAW_TABLE_KEYWORD]) {
      for (const m of file.content.matchAll(pattern)) {
        const schema = m[1] ?? "";
        const owner = schemaOwner.get(schema);
        const at = m.index + m[0].indexOf(schema);
        if (!owner || owner === own || seenTables.has(at)) continue;
        seenTables.add(at);
        report(at, `table ${m[0].slice(m[0].indexOf(schema) - 1).trim()} du module ${owner.dir}`);
      }
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
