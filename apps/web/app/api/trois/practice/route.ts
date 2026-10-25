import { requireMember } from "@app/core";
import { practiceGuess } from "@app/trois";
import { errorResponse, json } from "@/lib/route";

/** TROIS, mode test : rejouer un mot déjà terminé, sans rien enregistrer. */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const body = (await request.json().catch(() => ({}))) as { guess?: unknown; slot?: unknown };
    return json(await practiceGuess({ userId: user.id, guess: body.guess, slot: body.slot }));
  } catch (error) {
    return errorResponse(error);
  }
}
