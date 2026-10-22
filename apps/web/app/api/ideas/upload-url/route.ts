import { requireMember } from "@app/core";
import { createUploadUrl } from "@app/ideas";
import { z } from "zod";
import { errorResponse } from "@/lib/route";

const body = z.object({ contentType: z.string().max(100), size: z.number() });

/** Autorise l'envoi d'une image de la boîte à idées : renvoie `{ key, url }` (PUT présigné, 5 min). */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const input = body.parse(await request.json().catch(() => null));
    return Response.json(await createUploadUrl(user.id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
