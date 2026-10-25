import { createGame, listGames, listPartners } from "@app/agents";
import { requireMember } from "@app/core";
import { errorResponse, json } from "@/lib/route";

/**
 * Agents Doubles : mes parties. Avec `?partners=1`, aussi les membres qu'on peut inviter (demandés
 * au premier chargement du salon seulement, pas à chaque rafraîchissement).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const withPartners = new URL(request.url).searchParams.get("partners") === "1";
    const [games, partners] = await Promise.all([
      listGames(user.id),
      withPartners ? listPartners(user.id) : undefined,
    ]);
    return json(partners ? { games, partners } : { games });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Nouvelle partie avec un membre (ou la partie déjà en cours avec lui). */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const body = (await request.json().catch(() => ({}))) as { partnerId?: unknown };
    return json(await createGame({ userId: user.id, partnerId: body.partnerId }));
  } catch (error) {
    return errorResponse(error);
  }
}
