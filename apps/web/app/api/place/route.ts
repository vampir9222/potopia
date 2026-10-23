import { requireMember } from "@app/core";
import { z } from "zod";
import { getPlaceSnapshot } from "@/lib/avatar";
import { errorResponse } from "@/lib/route";

/** Au plus 10 min d'historique : un onglet resté en veille ne rejoue pas toute la journée. */
const MAX_LOOKBACK_MS = 10 * 60 * 1000;

const query = z.object({ since: z.iso.datetime().optional() });

/** La place : membres (planche courante, dernière activité) et événements depuis `since`. */
export async function GET(request: Request): Promise<Response> {
  try {
    await requireMember(request.headers);
    const { since } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    const floor = Date.now() - MAX_LOOKBACK_MS;
    const from = since ? new Date(Math.max(new Date(since).getTime(), floor)) : undefined;
    return Response.json(await getPlaceSnapshot(from), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
