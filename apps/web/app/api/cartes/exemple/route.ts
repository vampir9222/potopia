import { requireMember } from "@app/core";
import { getShowcaseImageUrl } from "@app/ideas";
import { errorResponse } from "@/lib/route";

/**
 * Image de la carte exemple du vote des designs : tout membre, redirection vers une URL présignée
 * valable 5 min. Seule idée dont l'image est visible hors admin (exception à la boîte noire).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    await requireMember(request.headers);
    const url = await getShowcaseImageUrl();
    if (!url) return Response.json({ error: "Pas d'image." }, { status: 404 });
    return new Response(null, {
      status: 302,
      headers: { location: url, "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
