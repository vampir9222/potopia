import { catalog as realCatalog, palettes as realPalettes } from "@app/avatar-assets";
import { describe, expect, it } from "vitest";
import { avatarConfigSchema } from "../src/config";
import { configHash } from "../src/hash";
import { randomConfig } from "../src/random";
import { availableMorphs, checkConfig, fitConfig, optionsFor } from "../src/rules";
import { baseConfig, catalog, palettes } from "./fixtures";

describe("validation d'une config", () => {
  it("accepte une config cohérente", () => {
    expect(checkConfig(baseConfig(), catalog, palettes)).toEqual([]);
  });

  it("refuse un élément inexistant", () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_human" }, hat: { id: "inconnu" } },
    });
    expect(checkConfig(config, catalog, palettes)).toEqual(["Élément inconnu : inconnu."]);
  });

  it("refuse un élément rangé dans une autre catégorie", () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_human" }, hat: { id: "shirt" } },
    });
    expect(checkConfig(config, catalog, palettes)).toEqual(["Élément inconnu : shirt."]);
  });

  it("refuse un élément incompatible avec la morphologie", () => {
    const config = baseConfig({
      morph: "male",
      items: {
        body: { id: "body" },
        head: { id: "head_human" },
        legs: { id: "skirt_female_only" },
      },
    });
    expect(checkConfig(config, catalog, palettes)).toEqual([
      "« skirt_female_only » n'existe pas pour cette morphologie.",
    ]);
  });

  it("refuse un visage incompatible avec la tête choisie", () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_wolf" }, eyes: { id: "face_happy" } },
    });
    expect(checkConfig(config, catalog, palettes)).toEqual([
      "« face_happy » n'existe pas pour cette morphologie.",
    ]);
  });

  it("refuse un élément à débloquer non possédé, l'accepte s'il est possédé", () => {
    const config = baseConfig({
      items: { body: { id: "body" }, head: { id: "head_human" }, hat: { id: "crown" } },
    });
    expect(checkConfig(config, catalog, palettes)).toEqual(["« crown » n'est pas débloqué."]);
    expect(checkConfig(config, catalog, palettes, new Set(["crown"]))).toEqual([]);
  });

  it("refuse une couleur hors des palettes de l'emplacement", () => {
    const config = baseConfig({
      skin: "ulpc.red",
      items: {
        body: { id: "body" },
        head: { id: "head_human" },
        torso: { id: "shirt", colors: { main: "ulpc.green" } },
      },
    });
    expect(checkConfig(config, catalog, palettes)).toEqual([
      "Couleur de peau invalide.",
      "Couleur invalide pour « shirt ».",
    ]);
  });

  it("refuse une robe portée avec un pantalon, et exige corps et tête", () => {
    const config = baseConfig({
      items: { body: { id: "body" }, dress: { id: "dress" }, legs: { id: "pants" } },
    });
    expect(checkConfig(config, catalog, palettes)).toEqual([
      "Élément obligatoire manquant : head.",
      "« pants » ne se porte pas avec cette tenue.",
    ]);
  });

  it("le schéma zod refuse une forme invalide", () => {
    expect(avatarConfigSchema.safeParse({ ...baseConfig(), morph: "dragon" }).success).toBe(false);
    expect(avatarConfigSchema.safeParse({ ...baseConfig(), skin: "<script>" }).success).toBe(false);
    expect(avatarConfigSchema.safeParse(baseConfig()).success).toBe(true);
  });
});

describe("ajustement et options", () => {
  it("ne propose que les éléments compatibles avec la morphologie", () => {
    const male = optionsFor(catalog, baseConfig({ morph: "male" }), "legs").map((i) => i.id);
    const female = optionsFor(catalog, baseConfig({ morph: "female" }), "legs").map((i) => i.id);
    expect(male).toEqual(["pants"]);
    expect(female).toEqual(["pants", "skirt_female_only"]);
  });

  it("fitConfig retire ce qui ne va plus après un changement de morphologie", () => {
    const female = baseConfig({
      morph: "female",
      items: {
        body: { id: "body" },
        head: { id: "head_human" },
        legs: { id: "skirt_female_only" },
      },
    });
    expect(fitConfig({ ...female, morph: "male" }, catalog).items).toEqual({
      body: { id: "body" },
      head: { id: "head_human" },
    });
    // La tête de loup n'existe qu'en « male » : elle est remplacée par une tête compatible.
    const wolf = baseConfig({ items: { body: { id: "body" }, head: { id: "head_wolf" } } });
    expect(fitConfig({ ...wolf, morph: "female" }, catalog).items.head).toEqual({
      id: "head_human",
    });
  });
});

describe("empreinte", () => {
  it("même config, même empreinte (quel que soit l'ordre des clés)", async () => {
    const a = baseConfig({
      items: {
        body: { id: "body" },
        head: { id: "head_human" },
        torso: { id: "shirt", colors: { main: "ulpc.red" } },
      },
    });
    const b = {
      items: {
        torso: { colors: { main: "ulpc.red" }, id: "shirt" },
        head: { id: "head_human" },
        body: { id: "body" },
      },
      eyes: a.eyes,
      skin: a.skin,
      morph: a.morph,
      v: 1 as const,
    };
    expect(await configHash(a, catalog)).toBe(await configHash(b, catalog));
    expect(await configHash(a, catalog)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("une config modifiée change l'empreinte", async () => {
    const a = baseConfig();
    expect(await configHash(a, catalog)).not.toBe(
      await configHash({ ...a, skin: "ulpc.brown" }, catalog),
    );
    expect(await configHash(a, catalog)).not.toBe(
      await configHash({ ...a, morph: "female" }, catalog),
    );
  });

  it("un nouvel import LPC change l'empreinte", async () => {
    const a = baseConfig();
    expect(await configHash(a, catalog)).not.toBe(
      await configHash(a, { source: { repo: "test", ref: "def" } }),
    );
  });
});

describe("avatar aléatoire (catalogue réel)", () => {
  it("est toujours valide, sur une centaine de tirages", () => {
    let seed = 42;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 100; i++) {
      const config = randomConfig(realCatalog, realPalettes, rng);
      expect(checkConfig(config, realCatalog, realPalettes)).toEqual([]);
      expect(config.items.body && config.items.head).toBeTruthy();
    }
  });

  it("le catalogue réel propose au moins une morphologie jouable", () => {
    expect(availableMorphs(realCatalog).length).toBeGreaterThan(0);
  });
});
