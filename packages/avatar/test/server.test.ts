import { catalog, palettes } from "@app/avatar-assets";
import { spritesDir } from "@app/avatar-assets/fs";
import { describe, expect, it } from "vitest";
import { composeSheet, sheetLayout } from "../src/compose";
import { randomConfig } from "../src/random";
import { decodePng, encodePng, fsSpriteLoader } from "../src/server";

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

  it("refuse un chemin qui sort du dossier des sprites", async () => {
    await expect(fsSpriteLoader(spritesDir)("../package.json")).rejects.toThrow("Sprite invalide");
  });
});
