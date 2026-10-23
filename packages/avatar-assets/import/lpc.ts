/**
 * Import des données LPC (Universal LPC Spritesheet Character Generator) : logique pure, sans
 * accès disque ni réseau, pour être testée. `run.ts` s'occupe de git et des fichiers.
 *
 * Seules les données (définitions JSON, palettes, PNG de base) sont reprises, jamais le code du
 * générateur (GPL).
 */
import {
  ANIMATIONS,
  FRAME_SIZE,
  MORPHS,
  type Animation,
  type Catalog,
  type CatalogItem,
  type Category,
  type ColorSlot,
  type Credit,
  type Layer,
  type Material,
  type Morph,
  type Palettes,
} from "../src/types";

/** `type_name` LPC → catégorie de l'éditeur. Tout autre type est écarté. */
export const TYPE_TO_CATEGORY: Record<string, Category> = {
  body: "body",
  head: "head",
  expression: "eyes",
  eyes: "eyes",
  hair: "hair",
  beard: "beards",
  mustache: "beards",
  facial_eyes: "facial",
  facial_mask: "facial",
  clothes: "torso",
  vest: "torso",
  jacket: "torso",
  armour: "torso",
  dress: "dress",
  legs: "legs",
  shoes: "feet",
  hat: "hat",
  headcover: "hat",
  bandana: "hat",
  neck: "neck",
  necklace: "neck",
  charm: "neck",
  cape: "cape",
  shoulders: "shoulders",
  bauldron: "shoulders",
  arms: "arms",
  gloves: "arms",
  bracers: "arms",
  wrists: "arms",
  backpack: "backpack",
};

const MATERIALS: readonly Material[] = ["body", "hair", "cloth", "eye", "metal", "wood"];

/** Corps de référence : ses planches fixent le nombre de frames de chaque animation. */
const REFERENCE_BODY = "body";
const REFERENCE_MORPH: Morph = "male";

type RawLayer = { zPos?: number; is_mask?: boolean; custom_animation?: string } & Partial<
  Record<Morph, string>
>;
type RawRecolor = { material?: string; base?: string; palettes?: string[] };
type RawCredit = {
  file?: string;
  notes?: string;
  authors?: string[];
  licenses?: string[];
  urls?: string[];
};

export type RawDefinition = {
  name?: string;
  type_name?: string;
  animations?: string[];
  recolors?: RawRecolor | Record<string, RawRecolor>;
  tags?: string[];
  required_tags?: string[];
  replace_in_path?: Record<string, Record<string, string>>;
  credits?: RawCredit[];
  [key: `layer_${number}`]: RawLayer | undefined;
};

export type DefinitionFile = {
  /** Chemin relatif à `sheet_definitions/`, sans `.json`. */
  path: string;
  def: RawDefinition;
};

/** Palettes LPC d'un matériau : version par défaut et couleur de base, couleurs par version. */
export type RawMaterialPalettes = {
  default: string;
  base: string;
  versions: Record<string, Record<string, string[]>>;
};

/** Dimensions d'un PNG relatif à `spritesheets/`, ou null s'il n'existe pas. */
export type Probe = (file: string) => { width: number; height: number } | null;

export type Rejection = { id: string; reason: string };

export type ImportResult = {
  catalog: Catalog;
  palettes: Palettes;
  credits: Credit[];
  rejected: Rejection[];
  /** Morphologies écartées pour les éléments retenus (id → raisons). */
  partial: Rejection[];
  /** PNG à copier, relatifs à `spritesheets/`. */
  files: string[];
};

export function itemId(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function rawLayers(def: RawDefinition): RawLayer[] {
  return Object.keys(def)
    .filter((key) => /^layer_\d+$/.test(key))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))
    .map((key) => def[key as `layer_${number}`])
    .filter((layer): layer is RawLayer => Boolean(layer));
}

function withSlash(dir: string): string {
  return dir.endsWith("/") ? dir : `${dir}/`;
}

function parseColors(
  def: RawDefinition,
  palettes: Partial<Record<Material, RawMaterialPalettes>>,
): ColorSlot[] | string {
  const recolors = def.recolors;
  if (!recolors) return [];
  const entries: [string, RawRecolor][] =
    "material" in recolors && typeof recolors.material === "string"
      ? [["main", recolors as RawRecolor]]
      : Object.entries(recolors as Record<string, RawRecolor>);

  const slots: ColorSlot[] = [];
  for (const [id, recolor] of entries) {
    const material = recolor.material as Material;
    const set = palettes[material];
    if (!MATERIALS.includes(material) || !set) return `matériau inconnu : ${recolor.material}`;
    // `base` peut omettre la version (`"leather"`) : c'est alors la version par défaut du matériau.
    const rawBase = recolor.base ?? set.base;
    const base = rawBase.includes(".") ? rawBase : `${set.default}.${rawBase}`;
    const [version, color] = base.split(".");
    if (!version || !color || !set.versions[version]?.[color]) {
      return `couleur de base inconnue : ${base}`;
    }
    const shared = material === "body" ? "skin" : material === "eye" ? "eyes" : undefined;
    slots.push({ id, material, base, ...(shared ? { shared } : {}) });
  }
  return slots;
}

/** Nombre de frames d'une planche (4 lignes de 64 px), ou un motif de refus. */
function framesOf(probe: Probe, file: string): number | string {
  const size = probe(file);
  if (!size) return "fichier absent";
  if (size.height !== FRAME_SIZE * 4 || size.width % FRAME_SIZE !== 0 || size.width === 0) {
    return `taille ${size.width}×${size.height} inattendue`;
  }
  return size.width / FRAME_SIZE;
}

/** Vérifie les 5 planches d'un dossier : renvoie null si tout va bien, sinon le motif. */
function checkDir(probe: Probe, dir: string, frames: Record<Animation, number>): string | null {
  for (const anim of ANIMATIONS) {
    const result = framesOf(probe, `${dir}${anim}.png`);
    if (typeof result === "string") return `${anim} : ${result}`;
    if (result !== frames[anim]) return `${anim} : ${result} frames au lieu de ${frames[anim]}`;
  }
  return null;
}

function referenceFrames(defs: DefinitionFile[], probe: Probe): Record<Animation, number> {
  const body = defs.find((d) => itemId(d.path) === REFERENCE_BODY);
  const dir = body && rawLayers(body.def)[0]?.[REFERENCE_MORPH];
  if (!dir) throw new Error(`Définition du corps de référence « ${REFERENCE_BODY} » introuvable.`);
  const frames = {} as Record<Animation, number>;
  for (const anim of ANIMATIONS) {
    const result = framesOf(probe, `${withSlash(dir)}${anim}.png`);
    if (typeof result === "string") throw new Error(`Corps de référence, ${anim} : ${result}`);
    frames[anim] = result;
  }
  return frames;
}

/**
 * Construit le catalogue : un élément n'est proposé pour une morphologie que si chacun de ses
 * calques existe pour elle avec les 5 animations, au bon nombre de frames.
 */
export function buildCatalog(input: {
  defs: DefinitionFile[];
  palettes: Partial<Record<Material, RawMaterialPalettes>>;
  probe: Probe;
  source: Catalog["source"];
}): ImportResult {
  const { palettes, probe } = input;
  const frames = referenceFrames(input.defs, probe);
  const rejected: Rejection[] = [];
  const partial: Rejection[] = [];
  const files = new Set<string>();
  const items: CatalogItem[] = [];
  const credits: Credit[] = [];

  // Les têtes d'abord : les visages en dépendent (`${head}` dans leur chemin).
  const category = (d: DefinitionFile) => TYPE_TO_CATEGORY[d.def.type_name ?? ""];
  const defs = [...input.defs].sort(
    (a, b) =>
      Number(category(b) === "head") - Number(category(a) === "head") ||
      a.path.localeCompare(b.path),
  );
  /** Nom LPC de la tête (`Human_Male`) → id de l'élément retenu. */
  const headByName = new Map<string, CatalogItem>();

  for (const { path, def } of defs) {
    const id = itemId(path);
    const reject = (reason: string) => rejected.push({ id, reason });
    const cat = category({ path, def });
    if (!cat) {
      reject(`catégorie exclue (${def.type_name ?? "sans type"})`);
      continue;
    }
    const raw = rawLayers(def);
    if (raw.some((l) => l.is_mask)) {
      reject("calque masque non géré");
      continue;
    }
    // Les calques `custom_animation` ne servent qu'à des animations hors périmètre.
    const layersRaw = raw.filter((l) => !l.custom_animation);
    if (layersRaw.length === 0) {
      reject("aucun calque");
      continue;
    }
    if (def.animations) {
      const missing = ANIMATIONS.filter((a) => !def.animations?.includes(a));
      if (missing.length > 0) {
        reject(`animation non déclarée : ${missing.join(", ")}`);
        continue;
      }
    }
    const colors = parseColors(def, palettes);
    if (typeof colors === "string") {
      reject(colors);
      continue;
    }

    const headMap = def.replace_in_path?.head;
    const layers: Layer[] = layersRaw.map((l) => {
      const dirs: Layer["dirs"] = {};
      for (const morph of MORPHS) {
        const dir = l[morph];
        if (dir) dirs[morph] = withSlash(dir);
      }
      return { zPos: l.zPos ?? 0, dirs };
    });
    const templated = layers.some((l) => Object.values(l.dirs).some((d) => d.includes("${head}")));

    const morphs: Morph[] = [];
    const reasons: string[] = [];
    const heads: Partial<Record<Morph, string[]>> = {};
    const headPaths: Record<string, string> = {};
    const used: string[] = [];

    for (const morph of MORPHS) {
      if (layers.some((l) => !l.dirs[morph])) {
        reasons.push(`${morph} : morphologie absente`);
        continue;
      }
      const dirsFor = (segment?: string) =>
        layers.map((l) => (l.dirs[morph] ?? "").replaceAll("${head}", segment ?? ""));

      if (!templated) {
        const dirs = dirsFor();
        const problem = dirs.map((d) => checkDir(probe, d, frames)).find(Boolean);
        if (problem) {
          reasons.push(`${morph} : ${problem}`);
          continue;
        }
        morphs.push(morph);
        used.push(...dirs);
        continue;
      }

      // Chemin qui dépend de la tête : compatible avec les têtes dont les planches existent.
      const ok: string[] = [];
      let lastProblem = "aucune tête compatible";
      for (const [headName, segment] of Object.entries(headMap ?? {})) {
        const head = headByName.get(headName);
        if (!head?.morphs.includes(morph)) continue;
        const dirs = dirsFor(segment);
        const problem = dirs.map((d) => checkDir(probe, d, frames)).find(Boolean);
        if (problem) {
          lastProblem = problem;
          continue;
        }
        ok.push(head.id);
        headPaths[head.id] = segment;
        used.push(...dirs);
      }
      if (ok.length === 0) {
        reasons.push(`${morph} : ${lastProblem}`);
        continue;
      }
      heads[morph] = ok;
      morphs.push(morph);
    }

    if (morphs.length === 0) {
      reject(reasons.join(" ; "));
      continue;
    }
    if (reasons.length > 0) partial.push({ id, reason: reasons.join(" ; ") });

    for (const dir of used) for (const anim of ANIMATIONS) files.add(`${dir}${anim}.png`);
    const item: CatalogItem = {
      id,
      category: cat,
      name: def.name ?? id,
      morphs,
      layers,
      frames,
      colors,
      tags: def.tags ?? [],
      requiredTags: def.required_tags ?? [],
      ...(templated ? { headPaths, heads } : {}),
      unlock: "free",
    };
    items.push(item);
    if (cat === "head" && def.name) headByName.set(def.name.replaceAll(" ", "_"), item);
    credits.push({
      itemId: id,
      name: item.name,
      category: cat,
      entries: (def.credits ?? []).map((c) => ({
        file: c.file ?? "",
        ...(c.notes ? { notes: c.notes } : {}),
        authors: c.authors ?? [],
        licenses: c.licenses ?? [],
        urls: c.urls ?? [],
      })),
    });
  }

  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Identifiant d'élément en double : ${item.id}`);
    ids.add(item.id);
  }

  items.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
  credits.sort((a, b) => a.category.localeCompare(b.category) || a.itemId.localeCompare(b.itemId));
  return {
    catalog: { source: input.source, frames, items },
    palettes: flattenPalettes(palettes),
    credits,
    rejected: rejected.sort((a, b) => a.id.localeCompare(b.id)),
    partial: partial.sort((a, b) => a.id.localeCompare(b.id)),
    files: [...files].sort(),
  };
}

/** Palettes par matériau, indexées par `<version>.<nom>`. */
function flattenPalettes(palettes: Partial<Record<Material, RawMaterialPalettes>>): Palettes {
  const out = {} as Palettes;
  for (const material of MATERIALS) {
    const colors: Record<string, string[]> = {};
    for (const [version, set] of Object.entries(palettes[material]?.versions ?? {})) {
      for (const [name, ramp] of Object.entries(set)) colors[`${version}.${name}`] = ramp;
    }
    out[material] = colors;
  }
  return out;
}

/** Largeur et hauteur d'un PNG, lues dans l'en-tête IHDR. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
