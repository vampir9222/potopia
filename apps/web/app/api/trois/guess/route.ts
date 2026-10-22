import { requireMember } from "@app/core";
import { playGuess } from "@app/trois";
import { errorResponse } from "@/lib/route";

/** TROIS : un essai sur le mot en cours. Le mot et l'emplacement sont validés par le jeu. */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const body = (await request.json().catch(() => ({}))) as { guess?: unknown; slot?: unknown };
    return Response.json(await playGuess({ userId: user.id, guess: body.guess, slot: body.slot }));
  } catch (error) {
    return errorResponse(error);
  }
}
