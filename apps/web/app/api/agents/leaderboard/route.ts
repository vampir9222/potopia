import { duoLeaderboard } from "@app/agents";
import { requireMember } from "@app/core";
import { errorResponse, json } from "@/lib/route";

/** Agents Doubles : classement des duos, du mois ou depuis le début (`?period=all`). */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const period = new URL(request.url).searchParams.get("period") === "all" ? "all" : "month";
    return json(await duoLeaderboard(user.id, period));
  } catch (error) {
    return errorResponse(error);
  }
}
