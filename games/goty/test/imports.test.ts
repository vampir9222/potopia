import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGameImportPreview, detectGameColumns } from "../src/import-preview";
import { IMPORT_MAX_BYTES, previewGameImport } from "../src/imports";

describe("Imports et prévisualisation", () => {
  it("détecte les colonnes accentuées et les valeurs booléennes usuelles", () => {
    const rows = [
      ["Titre", "Support", "Période", "Terminé", "Platine"],
      ["Jeu A", "PC", "été", "OUI", "✓"],
      ["Jeu A", "", "", "non", ""],
    ];
    const preview = buildGameImportPreview(rows, detectGameColumns(rows[0] ?? []));
    expect(preview.valid).toBe(true);
    expect(preview.games).toHaveLength(2);
    expect(preview.games[0]).toMatchObject({ title: "Jeu A", completed: true, platinum: true });
    expect(preview.games[1]?.completed).toBe(false);
  });
  it("signale chaque ligne invalide et exige un mapping correct", () => {
    const preview = buildGameImportPreview(
      [["Nom"], ["Valide"], [" ", "non vide"], ["x".repeat(201)]],
      { title: 0 },
    );
    expect(preview.valid).toBe(false);
    expect(preview.errors.map((e) => e.row)).toEqual([3, 4]);
    expect(buildGameImportPreview([["Nom"], ["Jeu"]], { title: 5 }).valid).toBe(false);
    expect(buildGameImportPreview([["Nom"], ["Jeu"]], {}).valid).toBe(false);
    expect(buildGameImportPreview([["Nom"]], { title: 0 }).valid).toBe(false);
  });
  it("lit BOM, point-virgule, guillemets et lignes vides sans évaluer les cellules", async () => {
    const data = new TextEncoder().encode('\uFEFFTitre;Terminé\n"Jeu; cité";oui\n\n=1+1;false');
    const preview = await previewGameImport({ format: "csv", data });
    expect(preview.valid).toBe(true);
    expect(preview.games.map((g) => g.title)).toEqual(["Jeu; cité", "=1+1"]);
    expect(preview.games[0]?.completed).toBe(true);
  });
  it("lit un XLSX réel et permet de réassocier les colonnes", async () => {
    const data = readFileSync(new URL("./fixtures/games.xlsx", import.meta.url));
    const preview = await previewGameImport({
      format: "xlsx",
      data,
      mapping: { title: 1, completed: 0 },
    });
    expect(preview.valid).toBe(true);
    expect(preview.games[0]).toMatchObject({ title: "Jeu XLSX fictif", completed: true });
  });
  it("refuse fichiers illisibles, trop volumineux et lots de plus de 1000 jeux", async () => {
    await expect(
      previewGameImport({ format: "xlsx", data: new TextEncoder().encode("pas un classeur") }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      previewGameImport({ format: "csv", data: new Uint8Array(IMPORT_MAX_BYTES + 1) }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      previewGameImport({ format: "csv", data: new Uint8Array([0xff, 0xfe]) }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      previewGameImport({
        format: "csv",
        data: new TextEncoder().encode("Titre\n" + Array(1001).fill("Jeu").join("\n")),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
