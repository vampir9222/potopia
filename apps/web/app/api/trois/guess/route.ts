import { requireMember } from "@app/core";
import { playGuess } from "@app/trois";
import { errorResponse, json } from "@/lib/route";

/**
 * TROIS : un essai sur le mot en cours. Le mot, l'emplacement et la journée jouée (`date`, celle
 * d'hier acceptée pendant le délai de grâce) sont validés par le jeu.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const body = (await request.json().catch(() => ({}))) as {
      guess?: unknown;
      slot?: unknown;
      date?: unknown;
    };
    return json(
      await playGuess({ userId: user.id, guess: body.guess, slot: body.slot, date: body.date }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
