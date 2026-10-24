import { AgentsError } from "@app/agents";
import { ForbiddenError, UnauthorizedError } from "@app/core";
import { InvalidImageError } from "@app/ideas";
import { TroisError } from "@app/trois";
import { ZodError } from "zod";

const STATUSES: [new (...args: never[]) => Error, number][] = [
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [InvalidImageError, 400],
];

/**
 * Traduit les erreurs connues en réponse JSON (401, 403, 400) pour les route handlers.
 * Les autres erreurs remontent (500), sans détail renvoyé au client.
 */
export function errorResponse(error: unknown): Response {
  // Erreurs de jeu : statut et message choisis par le jeu (essai refusé, mot inconnu…).
  if (error instanceof TroisError || error instanceof AgentsError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  for (const [type, status] of STATUSES) {
    if (error instanceof type) return Response.json({ error: error.message }, { status });
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Requête invalide.";
    return Response.json({ error: message }, { status: 400 });
  }
  throw error;
}
