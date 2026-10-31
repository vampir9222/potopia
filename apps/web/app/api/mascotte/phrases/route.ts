import { requireMember } from "@app/core";
import { readMascotPhrases } from "@/lib/mascot";
import { errorResponse, json } from "@/lib/route";

/** Phrases de la mascotte (bulle sur TROIS) : réservées aux membres. */
export async function GET(request: Request): Promise<Response> {
  try {
    await requireMember(request.headers);
    return json({ phrases: await readMascotPhrases() });
  } catch (error) {
    return errorResponse(error);
  }
}
