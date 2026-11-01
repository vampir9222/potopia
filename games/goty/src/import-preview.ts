import { z } from "zod";
import { gameInputSchema, type ParsedGameInput } from "./game-input";

export const IMPORT_FIELDS = [
  { key: "title", label: "Titre", aliases: ["titre", "title", "jeu", "nom"] },
  { key: "platform", label: "Support", aliases: ["support", "plateforme", "platform"] },
  { key: "period", label: "Période", aliases: ["periode", "period", "mois"] },
  { key: "completed", label: "Terminé", aliases: ["termine", "completed"] },
  { key: "platinum", label: "Platine", aliases: ["platine", "platinum"] },
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportMapping = Partial<Record<ImportField, number>>;
export type ImportPreview = {
  games: ParsedGameInput[];
  errors: { row: number; field: string; message: string }[];
  valid: boolean;
};

export function detectGameColumns(headers: readonly string[]): ImportMapping {
  const normalized = headers.map((h) =>
    h.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim(),
  );
  return Object.fromEntries(
    IMPORT_FIELDS.map((field) => [
      field.key,
      normalized.findIndex((h) => (field.aliases as readonly string[]).includes(h)),
    ]),
  );
}

/** Utilisable côté client ; aucune formule n'est exécutée et aucun fichier n'est persisté. */
export function buildGameImportPreview(rows: unknown, mapping: ImportMapping): ImportPreview {
  const parsedRows = z.array(z.array(z.string())).min(1).max(1001).safeParse(rows);
  const parsedMapping = z
    .object({
      title: z.number().int().nonnegative(),
      platform: z.number().int().min(-1).optional(),
      period: z.number().int().min(-1).optional(),
      completed: z.number().int().min(-1).optional(),
      platinum: z.number().int().min(-1).optional(),
    })
    .safeParse(mapping);
  const errors: ImportPreview["errors"] = [];
  if (!parsedRows.success || !parsedMapping.success)
    return {
      games: [],
      valid: false,
      errors: [
        {
          row: 1,
          field: "title",
          message: "Associe une colonne Titre et fournis au plus 1000 jeux.",
        },
      ],
    };
  const headers = parsedRows.data[0] ?? [];
  if (Object.values(parsedMapping.data).some((index) => index >= headers.length))
    return {
      games: [],
      valid: false,
      errors: [
        { row: 1, field: "mapping", message: "Une colonne associée est absente du fichier." },
      ],
    };
  const games: ParsedGameInput[] = [];
  parsedRows.data.slice(1).forEach((row, index) => {
    if (row.every((value) => !value.trim())) return;
    const value = (key: ImportField) => row[parsedMapping.data[key] ?? -1] ?? "";
    const truthy = (input: string) =>
      ["x", "oui", "yes", "true", "1", "vrai", "✓"].includes(input.trim().toLowerCase());
    const game = gameInputSchema.safeParse({
      title: value("title"),
      platform: value("platform"),
      period: value("period"),
      completed: truthy(value("completed")),
      platinum: truthy(value("platinum")),
    });
    if (game.success) games.push(game.data);
    else
      for (const issue of game.error.issues)
        errors.push({
          row: index + 2,
          field: String(issue.path[0] ?? "title"),
          message: "Valeur absente ou trop longue.",
        });
  });
  if (!games.length && !errors.length)
    errors.push({ row: 2, field: "title", message: "Le fichier ne contient aucun jeu." });
  return { games, errors, valid: errors.length === 0 };
}
