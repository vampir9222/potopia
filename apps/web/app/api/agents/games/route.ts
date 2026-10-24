import { createGame, listGames, listPartners } from "@app/agents";
import { requireMember } from "@app/core";
import { errorResponse } from "@/lib/route";

/** Agents Doubles : mes parties et les membres qu'on peut inviter. */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const [games, partners] = await Promise.all([listGames(user.id), listPartners(user.id)]);
    return Response.json({ games, partners });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Nouvelle partie avec un membre (ou la partie déjà en cours avec lui). */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const body = (await request.json().catch(() => ({}))) as { partnerId?: unknown };
    return Response.json(await createGame({ userId: user.id, partnerId: body.partnerId }));
  } catch (error) {
    return errorResponse(error);
  }
}
