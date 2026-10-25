import { basename, join } from "node:path";
import { catalog, palettes, spriteFile } from "@app/avatar-assets";
import { spritesDir } from "@app/avatar-assets/fs";
import { describe, expect, it } from "vitest";
import { composeSheet, sheetLayout } from "../src/compose";
import { randomConfig } from "../src/random";
import { decodePng, encodePng, fsSpriteLoader } from "../src/server";

/** Trois fichiers de sprites existants (premier calque de trois éléments différents). */
function someSpriteFiles(n: number): string[] {
  const files = new Set<string>();
  for (const item of catalog.items) {
    const layer = item.layers[0];
    const dir = layer?.dirs.male ?? layer?.dirs.female;
    if (dir && !dir.includes("${")) files.add(spriteFile(dir, "idle"));
    if (files.size === n) break;
  }
  return [...files];
}

describe("composition côté serveur (sprites réels)", () => {
  it("compose et encode la planche d'un avatar aléatoire", async () => {
    const config = randomConfig(catalog, palettes, () => 0.3);
    const sheet = await composeSheet(config, catalog, palettes, fsSpriteLoader(spritesDir));
    const png = await encodePng(sheet);
    const decoded = await decodePng(png);
    const layout = sheetLayout(catalog);
    expect([decoded.width, decoded.height]).toEqual([layout.width, layout.height]);
    // Le personnage est dessiné : des pixels opaques au centre de la première frame (idle, haut).
    const opaque = decoded.data.filter((_, i) => i % 4 === 3 && decoded.data[i] === 255).length;
    expect(opaque).toBeGreaterThan(1000);
  });

  it("refuse un chemin qui sort du dossier des sprites, même vers un dossier voisin de même préfixe", async () => {
    const load = fsSpriteLoader(spritesDir);
    await expect(load("../package.json")).rejects.toThrow("Sprite invalide");
    await expect(load(`../${basename(spritesDir)}-bis/x.png`)).rejects.toThrow("Sprite invalide");
    await expect(load(join(spritesDir, "..", "x.png"))).rejects.toThrow("Sprite invalide");
    await expect(load("sous/dossier/../../../x.png")).rejects.toThrow("Sprite invalide");
  });

  it("garde les sprites décodés dans la limite du budget, en évinçant les moins récents", async () => {
    const [a, b, c] = someSpriteFiles(3);
    if (!a || !b || !c) throw new Error("Pas assez de sprites dans le catalogue.");
    const size = (image: { width: number; height: number }) => image.width * image.height * 4;
    const first = await fsSpriteLoader(spritesDir)(a);
    const second = await fsSpriteLoader(spritesDir)(b);

    // Budget pour deux images : la troisième évince la moins récemment utilisée.
    const load = fsSpriteLoader(spritesDir, { maxBytes: size(first) + size(second) });
    const imageA = await load(a);
    await load(b);
    expect(load.stats()).toEqual({ entries: 2, bytes: size(first) + size(second) });
    expect(await load(a)).toBe(imageA); // relu : passe en tête
    await load(c);
    expect(load.stats().entries).toBeLessThanOrEqual(2);
    expect(load.stats().bytes).toBeLessThanOrEqual(size(first) + size(second));
    expect(await load(a)).toBe(imageA); // toujours en cache (b a été évincé)

    // Une image plus grande que le budget est servie sans être conservée.
    const tiny = fsSpriteLoader(spritesDir, { maxBytes: 1 });
    expect((await tiny(a)).width).toBe(imageA.width);
    expect(tiny.stats()).toEqual({ entries: 0, bytes: 0 });
  });
});
