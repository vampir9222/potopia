import { ForbiddenError, UnauthorizedError } from "@app/core";
import { GotyError } from "@app/goty";
import { ZodError } from "zod";
import { json } from "./route";

export function gotyError(error: unknown): Response {
  if (error instanceof GotyError)
    return json({ error: { code: error.code, message: error.message } }, { status: error.status });
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError)
    return json(
      {
        error: {
          code: error instanceof UnauthorizedError ? "UNAUTHORIZED" : "FORBIDDEN",
          message: "Connexion ou accès à vérifier.",
        },
      },
      { status: error instanceof UnauthorizedError ? 401 : 403 },
    );
  if (error instanceof ZodError || error instanceof SyntaxError)
    return json(
      { error: { code: "INVALID_INPUT", message: "Requête invalide." } },
      { status: 400 },
    );
  return json(
    {
      error: { code: "UNEXPECTED", message: "Une erreur est survenue. Réessaie dans un instant." },
    },
    { status: 500 },
  );
}

export function requireGotyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  if (origin !== expected || request.headers.get("sec-fetch-site") === "cross-site")
    throw new GotyError("FORBIDDEN", "Origine de la requête refusée.", 403);
}

export async function readGotyBody(request: Request, limit: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new GotyError("INVALID_INPUT", "Requête trop volumineuse.", 400);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
