import { requireMember } from "@app/core";
import { dayLeaderboard, periodLeaderboard } from "@app/trois";
import { errorResponse, json } from "@/lib/route";

/** TROIS : classement du jour (couleurs seulement), de la semaine ou du mois (`?period=`). */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const period = new URL(request.url).searchParams.get("period");
    if (period === "week" || period === "month") {
      return json(await periodLeaderboard(user.id, period));
    }
    return json(await dayLeaderboard(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
