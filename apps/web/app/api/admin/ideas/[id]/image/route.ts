import { requireAdmin } from "@app/core";
import { getIdeaImageUrl } from "@app/ideas";
import { errorResponse } from "@/lib/route";

/** Image d'une idée : admin uniquement, redirection vers une URL présignée valable 5 min. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const admin = await requireAdmin(request.headers);
    const url = await getIdeaImageUrl(admin, (await params).id);
    if (!url) return Response.json({ error: "Pas d'image." }, { status: 404 });
    return new Response(null, {
      status: 302,
      // L'URL présignée ne doit pas être mise en cache plus longtemps qu'elle n'est valable.
      headers: { location: url, "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
