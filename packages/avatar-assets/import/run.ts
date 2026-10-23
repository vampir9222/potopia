/**
 * Import LPC : récupère les données du générateur (clone partiel épinglé sur un commit), construit
 * le catalogue et régénère `sprites/` et `data/`. Relançable : la sortie est entièrement réécrite.
 *
 *   pnpm assets:import [--ref <commit>]
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ANIMATIONS, type Material } from "../src/types";
import {
  buildCatalog,
  pngSize,
  type DefinitionFile,
  type RawDefinition,
  type RawMaterialPalettes,
} from "./lpc";

const REPO = "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator";
/** Commit importé par défaut : le changer relance la composition de toutes les planches. */
const DEFAULT_REF = "9bf06be193b053db256b2536824af426de046aa2";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const rootDir = join(packageDir, "..", "..");
const cacheDir = join(rootDir, ".cache", "lpc");

function git(args: string[], cwd = cacheDir): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

/**
 * Clone partiel : uniquement les définitions, les palettes et les PNG de base des 5 animations
 * (les variantes de couleur précalculées sont dans des sous-dossiers `<animation>/`, non prises).
 */
function fetchRepo(ref: string): void {
  if (!existsSync(join(cacheDir, ".git"))) {
    mkdirSync(cacheDir, { recursive: true });
    git(["init", "--quiet"]);
    git(["remote", "add", "origin", REPO]);
  }
  git([
    "sparse-checkout",
    "set",
    "--no-cone",
    "/sheet_definitions/",
    "/palette_definitions/",
    ...ANIMATIONS.map((a) => `/spritesheets/**/${a}.png`),
  ]);
  console.log(`Récupération de ${ref.slice(0, 7)}…`);
  git(["fetch", "--quiet", "--depth", "1", "--filter=blob:none", "origin", ref]);
  git(["checkout", "--quiet", "--force", "FETCH_HEAD"]);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const posix = (path: string) => path.split("\\").join("/");

function readDefinitions(): DefinitionFile[] {
  const dir = join(cacheDir, "sheet_definitions");
  return walk(dir)
    .filter((f) => f.endsWith(".json") && !f.split(/[\\/]/).pop()?.startsWith("meta_"))
    .map((f) => ({
      path: posix(relative(dir, f)).replace(/\.json$/, ""),
      def: JSON.parse(readFileSync(f, "utf8")) as RawDefinition,
    }));
}

function readPalettes(): Partial<Record<Material, RawMaterialPalettes>> {
  const dir = join(cacheDir, "palette_definitions");
  const out: Partial<Record<Material, RawMaterialPalettes>> = {};
  for (const material of ["body", "hair", "cloth", "eye", "metal", "wood"] as const) {
    const meta = JSON.parse(readFileSync(join(dir, material, `meta_${material}.json`), "utf8")) as {
      default: string;
      base: string;
    };
    const versions: RawMaterialPalettes["versions"] = {};
    for (const file of readdirSync(join(dir, material))) {
      const match = new RegExp(`^${material}_(\\w+)\\.json$`).exec(file);
      if (match?.[1])
        versions[match[1]] = JSON.parse(readFileSync(join(dir, material, file), "utf8"));
    }
    out[material] = { default: meta.default, base: meta.base, versions };
  }
  return out;
}

function main(): void {
  const refIndex = process.argv.indexOf("--ref");
  const ref = (refIndex > 0 && process.argv[refIndex + 1]) || DEFAULT_REF;
  fetchRepo(ref);
  const commit = git(["rev-parse", "HEAD"]).trim();

  const sheets = join(cacheDir, "spritesheets");
  const result = buildCatalog({
    defs: readDefinitions(),
    palettes: readPalettes(),
    probe: (file) => {
      const path = join(sheets, file);
      return existsSync(path) ? pngSize(readFileSync(path)) : null;
    },
    source: { repo: REPO, ref: commit },
  });

  const spritesDir = join(packageDir, "sprites");
  const dataDir = join(packageDir, "data");
  rmSync(spritesDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  let bytes = 0;
  for (const file of result.files) {
    const target = join(spritesDir, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(sheets, file), target);
    bytes += readFileSync(target).length;
  }
  writeFileSync(join(dataDir, "catalog.json"), `${JSON.stringify(result.catalog)}\n`);
  writeFileSync(join(dataDir, "palettes.json"), `${JSON.stringify(result.palettes)}\n`);
  writeFileSync(join(dataDir, "credits.json"), `${JSON.stringify(result.credits)}\n`);

  console.log("\nÉléments écartés :");
  for (const r of result.rejected) console.log(`  - ${r.id} : ${r.reason}`);
  console.log("\nMorphologies écartées (éléments retenus) :");
  for (const r of result.partial) console.log(`  - ${r.id} : ${r.reason}`);

  const byCategory = new Map<string, number>();
  for (const item of result.catalog.items) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  }
  console.log(`\nCommit ${commit}`);
  console.log(
    `${result.catalog.items.length} éléments retenus, ${result.rejected.length} écartés, ` +
      `${result.files.length} PNG (${(bytes / 1024 / 1024).toFixed(1)} Mo).`,
  );
  console.log([...byCategory].map(([c, n]) => `${c} ${n}`).join(", "));
}

main();
