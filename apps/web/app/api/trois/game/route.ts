import { requireMember } from "@app/core";
import { getToday } from "@app/trois";
import { errorResponse, json } from "@/lib/route";

/** TROIS : la journée du joueur (réponses des mots terminés uniquement) et ses stats. */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    return json(await getToday(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
