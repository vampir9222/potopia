import { describe, expect, it } from "vitest";
import {
  buildCatalog,
  pngSize,
  type DefinitionFile,
  type RawMaterialPalettes,
} from "../import/lpc";
import { ANIMATIONS } from "../src/types";

const FRAMES = { idle: 2, walk: 9, sit: 3, jump: 5, emote: 3 } as const;

const palettes: Partial<Record<"body" | "cloth", RawMaterialPalettes>> = {
  body: {
    default: "ulpc",
    base: "light",
    versions: { ulpc: { light: ["#111111", "#222222"], dark: ["#000000", "#010101"] } },
  },
  cloth: { default: "ulpc", base: "white", versions: { ulpc: { white: ["#ffffff"] } } },
};

/** Fichiers présents : les 5 planches de chaque dossier listé, à la bonne taille. */
function probeFor(
  dirs: string[],
  overrides: Record<string, { width: number; height: number } | null> = {},
) {
  const files = new Map<string, { width: number; height: number } | null>();
  for (const dir of dirs) {
    for (const anim of ANIMATIONS)
      files.set(`${dir}${anim}.png`, { width: FRAMES[anim] * 64, height: 256 });
  }
  for (const [file, size] of Object.entries(overrides)) files.set(file, size);
  return (file: string) => files.get(file) ?? null;
}

const body: DefinitionFile = {
  path: "body/body",
  def: {
    name: "Body",
    type_name: "body",
    layer_1: { zPos: 10, male: "body/male/", female: "body/female/" },
    recolors: { material: "body", palettes: ["ulpc"] },
  },
};

function run(defs: DefinitionFile[], probe: ReturnType<typeof probeFor>) {
  return buildCatalog({ defs: [body, ...defs], palettes, probe, source: { repo: "r", ref: "x" } });
}

describe("import LPC", () => {
  it("garde un élément complet et enregistre ses frames par animation", () => {
    const result = run([], probeFor(["body/male/", "body/female/"]));
    const item = result.catalog.items.find((i) => i.id === "body");
    expect(item?.morphs).toEqual(["male", "female"]);
    expect(item?.frames).toEqual(FRAMES);
    expect(item?.colors).toEqual([
      { id: "main", material: "body", base: "ulpc.light", shared: "skin" },
    ]);
    expect(result.files).toContain("body/male/emote.png");
  });

  it("écarte un élément auquel il manque l'une des 5 animations", () => {
    const shirt: DefinitionFile = {
      path: "torso/shirt",
      def: { type_name: "clothes", layer_1: { zPos: 35, male: "shirt/male/" } },
    };
    const result = run(
      [shirt],
      probeFor(["body/male/", "body/female/", "shirt/male/"], { "shirt/male/sit.png": null }),
    );
    expect(result.catalog.items.map((i) => i.id)).not.toContain("shirt");
    expect(result.rejected).toContainEqual({
      id: "shirt",
      reason: expect.stringContaining("sit : fichier absent"),
    });
  });

  it("écarte un élément dont la définition ne déclare pas les 5 animations", () => {
    const dress: DefinitionFile = {
      path: "torso/dress",
      def: {
        type_name: "dress",
        animations: ["walk", "idle"],
        layer_1: { zPos: 9, male: "dress/" },
      },
    };
    const result = run([dress], probeFor(["body/male/", "body/female/", "dress/"]));
    expect(result.rejected).toContainEqual({
      id: "dress",
      reason: "animation non déclarée : sit, jump, emote",
    });
  });

  it("admet une cape sans sit, jump ni emote, avec ses animations de remplacement", () => {
    const cape: DefinitionFile = {
      path: "torso/cape",
      def: { type_name: "cape", animations: ["walk", "idle"], layer_1: { zPos: 9, male: "cape/" } },
    };
    const probe = probeFor(["body/male/", "body/female/"], {
      "cape/idle.png": { width: 128, height: 256 },
      "cape/walk.png": { width: 576, height: 256 },
    });
    const result = run([cape], probe);
    const item = result.catalog.items.find((i) => i.id === "cape");
    expect(item?.fallbacks).toEqual({ emote: "idle", sit: null, jump: null });
    expect(result.files.filter((f) => f.startsWith("cape/"))).toEqual([
      "cape/idle.png",
      "cape/walk.png",
    ]);
    // Sans walk, la cape reste écartée.
    const noWalk = run(
      [cape],
      probeFor(["body/male/", "body/female/"], { "cape/idle.png": { width: 128, height: 256 } }),
    );
    expect(noWalk.rejected.map((r) => r.id)).toContain("cape");
  });

  it("ne garde que les têtes humaines masculine et féminine", () => {
    const head = (name: string): DefinitionFile => ({
      path: `head/${name}`,
      def: { name, type_name: "head", layer_1: { zPos: 100, male: `${name}/` } },
    });
    const result = run(
      [head("heads_human_male"), head("heads_wolf_male")],
      probeFor(["body/male/", "body/female/", "heads_human_male/", "heads_wolf_male/"]),
    );
    expect(result.catalog.items.filter((i) => i.category === "head").map((i) => i.id)).toEqual([
      "heads_human_male",
    ]);
    expect(result.rejected).toContainEqual({
      id: "heads_wolf_male",
      reason: "hors de la liste retenue pour sa catégorie",
    });
  });

  it("ne propose un élément que pour les morphologies où il existe", () => {
    const pants: DefinitionFile = {
      path: "legs/pants",
      def: { type_name: "legs", layer_1: { zPos: 20, male: "pants/male/" } },
    };
    const result = run([pants], probeFor(["body/male/", "body/female/", "pants/male/"]));
    expect(result.catalog.items.find((i) => i.id === "pants")?.morphs).toEqual(["male"]);
    expect(result.partial).toContainEqual({
      id: "pants",
      reason: expect.stringContaining("female : morphologie absente"),
    });
  });

  it("écarte un élément sans la morphologie demandée", () => {
    const noMorph: DefinitionFile = {
      path: "hat/none",
      def: { type_name: "hat", layer_1: { zPos: 120 } },
    };
    expect(run([noMorph], probeFor(["body/male/", "body/female/"])).rejected).toContainEqual({
      id: "none",
      reason: expect.stringContaining("male : morphologie absente"),
    });
  });

  it("écarte un élément dont une planche n'a pas le bon nombre de frames", () => {
    const shoes: DefinitionFile = {
      path: "feet/shoes",
      def: { type_name: "shoes", layer_1: { zPos: 15, male: "shoes/" } },
    };
    const result = run(
      [shoes],
      probeFor(["body/male/", "body/female/", "shoes/"], {
        "shoes/walk.png": { width: 512, height: 256 },
      }),
    );
    expect(result.rejected).toContainEqual({
      id: "shoes",
      reason: expect.stringContaining("walk : 8 frames au lieu de 9"),
    });
  });

  it("garde chaque calque d'un élément multi-calques avec son propre zPos", () => {
    const cape: DefinitionFile = {
      path: "torso/cape",
      def: {
        type_name: "cape",
        layer_1: { zPos: 110, male: "cape/fg/" },
        layer_2: { zPos: 5, male: "cape/bg/" },
        layer_3: { zPos: 1, male: "cape/custom/", custom_animation: "wheelchair" },
      },
    };
    const result = run([cape], probeFor(["body/male/", "body/female/", "cape/fg/", "cape/bg/"]));
    expect(result.catalog.items.find((i) => i.id === "cape")?.layers).toEqual([
      { zPos: 110, dirs: { male: "cape/fg/" } },
      { zPos: 5, dirs: { male: "cape/bg/" } },
    ]);
    // Un calque manquant écarte la morphologie entière.
    const partial = run([cape], probeFor(["body/male/", "body/female/", "cape/fg/"]));
    expect(partial.rejected.map((r) => r.id)).toContain("cape");
  });

  it("écarte les catégories hors périmètre (armes, outils, carquois…)", () => {
    const sword: DefinitionFile = {
      path: "weapons/sword",
      def: { type_name: "weapon", layer_1: { zPos: 140, male: "sword/" } },
    };
    const result = run([sword], probeFor(["body/male/", "body/female/", "sword/"]));
    expect(result.rejected).toContainEqual({ id: "sword", reason: "catégorie exclue (weapon)" });
  });

  it("résout les chemins qui dépendent de la tête", () => {
    const head: DefinitionFile = {
      path: "head/heads_human_male",
      def: {
        name: "Human Male",
        type_name: "head",
        tags: ["human"],
        layer_1: { zPos: 100, male: "head/human/" },
      },
    };
    const face: DefinitionFile = {
      path: "head/face_neutral",
      def: {
        type_name: "expression",
        required_tags: ["human"],
        replace_in_path: { head: { Human_Male: "male", Human_Female: "female" } },
        layer_1: { zPos: 101, male: "faces/${head}/neutral/" },
      },
    };
    const result = run(
      [face, head],
      probeFor(["body/male/", "body/female/", "head/human/", "faces/male/neutral/"]),
    );
    const item = result.catalog.items.find((i) => i.id === "face_neutral");
    expect(item?.heads).toEqual({ male: ["heads_human_male"] });
    expect(item?.headPaths).toEqual({ heads_human_male: "male" });
    expect(item?.requiredTags).toEqual(["human"]);
  });

  it("lit la taille d'un PNG dans son en-tête", () => {
    const header = new Uint8Array(24);
    header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(header.buffer).setUint32(16, 576);
    new DataView(header.buffer).setUint32(20, 256);
    expect(pngSize(header)).toEqual({ width: 576, height: 256 });
    expect(pngSize(new Uint8Array(24))).toBeNull();
  });
});
