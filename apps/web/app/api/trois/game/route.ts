import { requireMember } from "@app/core";
import { getToday } from "@app/trois";
import { errorResponse, json } from "@/lib/route";

/**
 * TROIS : la journée du joueur (réponses des mots terminés uniquement) et ses stats. Juste après
 * minuit, celle d'hier si elle est encore dans son délai de grâce, sauf avec `?today=1`.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const today = new URL(request.url).searchParams.get("today") === "1";
    return json(await getToday(user.id, { today }));
  } catch (error) {
    return errorResponse(error);
  }
}
