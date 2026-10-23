import { describe, expect, it } from "vitest";
import { composeSheet, resolveLayers, sheetLayout, type RgbaImage } from "../src/compose";
import { baseConfig, catalog, fakeLoader, palettes, pixel } from "./fixtures";

function rgbaAt(image: RgbaImage, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return [...image.data.slice(i, i + 4)];
}

describe("compositeur", () => {
  it("dispose les 5 animations sur 4 directions, sur la largeur de la plus longue", () => {
    expect(sheetLayout(catalog)).toEqual({
      width: 128,
      height: 20 * 64,
      frames: catalog.frames,
      rows: { idle: 0, walk: 4, sit: 8, jump: 12, emote: 16 },
    });
  });

  it("trie tous les calques des éléments choisis par zPos", () => {
    const config = baseConfig({
      items: {
        body: { id: "body" },
        head: { id: "head_human" },
        torso: { id: "shirt" },
        legs: { id: "pants" },
      },
    });
    expect(resolveLayers(config, catalog, palettes).map((l) => `${l.itemId}:${l.zPos}`)).toEqual([
      "body:10",
      "pants:20",
      "shirt:35",
      "head_human:100",
    ]);
  });

  it("intercale les calques d'un élément multi-calques (cape derrière et devant le corps)", () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_human" }, cape: { id: "cape" } },
    });
    expect(resolveLayers(config, catalog, palettes).map((l) => l.dir)).toEqual([
      "cape/bg/",
      "body/",
      "head/",
      "cape/fg/",
    ]);
  });

  it("le calque de zPos le plus haut est dessiné par-dessus", async () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_human" }, torso: { id: "shirt" } },
    });
    const load = fakeLoader({
      "body/": pixel("#123456"),
      "shirt/": pixel("#abcdef"),
      "head/": pixel("#000000", 0),
    });
    const sheet = await composeSheet(config, catalog, palettes, load);
    expect(rgbaAt(sheet, 0, 0)).toEqual([0xab, 0xcd, 0xef, 255]);
    // Même chose sur la ligne de chaque animation (ici walk, ligne 4).
    expect(rgbaAt(sheet, 0, 4 * 64)).toEqual([0xab, 0xcd, 0xef, 255]);
  });

  it("une robe exclut le pantalon", async () => {
    const config = baseConfig({
      morph: "female",
      items: {
        body: { id: "body" },
        head: { id: "head_human" },
        dress: { id: "dress" },
        legs: { id: "pants" },
      },
    });
    const layers = resolveLayers(config, catalog, palettes).map((l) => l.itemId);
    expect(layers).toContain("dress");
    expect(layers).not.toContain("pants");
    const load = fakeLoader({});
    await composeSheet(config, catalog, palettes, load);
    expect(load.calls.some((f) => f.startsWith("pants/"))).toBe(false);
  });

  it("applique la couleur de peau au corps et à la tête, et la couleur choisie aux vêtements", async () => {
    const config = baseConfig({
      skin: "ulpc.brown",
      items: {
        body: { id: "body" },
        head: { id: "head_human" },
        torso: { id: "shirt", colors: { main: "ulpc.red" } },
      },
    });
    const layers = resolveLayers(config, catalog, palettes);
    const swapOf = (id: string) => layers.find((l) => l.itemId === id)?.swap;
    expect(swapOf("body")?.get(0xffeedd)).toBe(0x553322);
    expect(swapOf("head_human")?.get(0xeeddcc)).toBe(0x442211);
    expect(swapOf("shirt")?.get(0xffffff)).toBe(0xff0000);

    const sheet = await composeSheet(
      config,
      catalog,
      palettes,
      fakeLoader({ "body/": pixel("#ffeedd") }),
    );
    expect(rgbaAt(sheet, 0, 0)).toEqual([0x55, 0x33, 0x22, 255]);
  });

  it("résout le chemin d'un visage selon la tête choisie", () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_human" }, eyes: { id: "face_happy" } },
    });
    expect(resolveLayers(config, catalog, palettes).map((l) => l.dir)).toContain(
      "faces/human/happy/",
    );
  });

  it("reprend les frames d'une autre animation, ou ne dessine pas, pour une cape incomplète", async () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_human" }, cape: { id: "cloak" } },
    });
    const load = fakeLoader({ "cloak/": pixel("#336699") });
    const sheet = await composeSheet(config, catalog, palettes, load);
    const cloakFiles = load.calls.filter((f) => f.startsWith("cloak/"));
    expect(cloakFiles.sort()).toEqual(["cloak/idle.png", "cloak/idle.png", "cloak/walk.png"]);
    // emote (ligne 16) : frame de idle ; sit (ligne 8) et jump (ligne 12) : rien.
    expect(rgbaAt(sheet, 0, 16 * 64)).toEqual([0x33, 0x66, 0x99, 255]);
    expect(rgbaAt(sheet, 0, 8 * 64)[3]).toBe(0);
    expect(rgbaAt(sheet, 0, 12 * 64)[3]).toBe(0);
  });

  it("mélange un pixel semi-transparent avec le dessous", async () => {
    const config = baseConfig({ items: { body: { id: "body" }, head: { id: "head_human" } } });
    const load = fakeLoader({ "body/": pixel("#000000"), "head/": pixel("#ffffff", 128) });
    const sheet = await composeSheet(config, catalog, palettes, load);
    const [r, , , a] = rgbaAt(sheet, 0, 0);
    expect(r).toBeGreaterThan(120);
    expect(r).toBeLessThan(135);
    expect(a).toBe(255);
  });
});
