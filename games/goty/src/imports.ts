import Papa from "papaparse";
import readXlsxFile from "read-excel-file/node";
import { GotyError } from "./errors";
import { buildGameImportPreview, detectGameColumns, type ImportMapping } from "./import-preview";

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Lecture et aperçu uniquement ; la confirmation passe par addGames, qui revalide tout. */
export async function previewGameImport(input: {
  format: "csv" | "xlsx";
  data: Uint8Array;
  mapping?: ImportMapping;
}) {
  if (
    !input ||
    !(input.data instanceof Uint8Array) ||
    input.data.byteLength > IMPORT_MAX_BYTES ||
    input.data.byteLength === 0 ||
    !["csv", "xlsx"].includes(input.format)
  )
    throw new GotyError("INVALID_INPUT", "Choisis un fichier CSV ou XLSX de 5 Mo maximum.", 400);
  let rows: string[][];
  try {
    if (input.format === "csv") {
      const parsed = Papa.parse<string[]>(
        new TextDecoder("utf-8", { fatal: true }).decode(input.data),
        { skipEmptyLines: "greedy", preview: 1002 },
      );
      if (parsed.errors.some((error) => error.code !== "UndetectableDelimiter"))
        throw new Error("CSV invalide");
      rows = parsed.data;
    } else {
      const values = await readXlsxFile(Buffer.from(input.data));
      rows = values.map((row) =>
        row.map((cell) =>
          cell === null
            ? ""
            : cell instanceof Date
              ? cell.toISOString().slice(0, 10)
              : String(cell),
        ),
      );
    }
  } catch {
    throw new GotyError(
      "INVALID_INPUT",
      "Ce fichier ne peut pas être lu. Utilise un CSV UTF-8 ou un XLSX valide.",
      400,
    );
  }
  if (rows.length > 1001)
    throw new GotyError("INVALID_INPUT", "L’import est limité à 1000 jeux.", 400);
  const headers = rows[0] ?? [];
  const mapping = input.mapping ?? detectGameColumns(headers);
  return { headers, mapping, ...buildGameImportPreview(rows, mapping) };
}
