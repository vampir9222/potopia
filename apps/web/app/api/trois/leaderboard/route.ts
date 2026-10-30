import { requireMember } from "@app/core";
import { dayLeaderboard, periodLeaderboard } from "@app/trois";
import { errorResponse, json } from "@/lib/route";

/**
 * TROIS : classement du jour (couleurs seulement), de la semaine ou du mois (`?period=`). Avec
 * `?date=AAAA-MM-JJ`, le jour (ou la période qui le contient) dans l'historique.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const params = new URL(request.url).searchParams;
    const period = params.get("period");
    const date = params.get("date") ?? undefined;
    if (period === "week" || period === "month") {
      return json(await periodLeaderboard(user.id, period, { date }));
    }
    return json(await dayLeaderboard(user.id, { date }));
  } catch (error) {
    return errorResponse(error);
  }
}
