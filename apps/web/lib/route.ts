import { ForbiddenError, UnauthorizedError } from "@app/core";
import { InvalidImageError, RateLimitError } from "@app/ideas";
import { ZodError } from "zod";

const STATUSES: [new (...args: never[]) => Error, number][] = [
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [RateLimitError, 429],
  [InvalidImageError, 400],
];

/**
 * Traduit les erreurs connues en réponse JSON (401, 403, 400, 429) pour les route handlers.
 * Les autres erreurs remontent (500), sans détail renvoyé au client.
 */
export function errorResponse(error: unknown): Response {
  for (const [type, status] of STATUSES) {
    if (error instanceof type) return Response.json({ error: error.message }, { status });
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Requête invalide.";
    return Response.json({ error: message }, { status: 400 });
  }
  throw error;
}
