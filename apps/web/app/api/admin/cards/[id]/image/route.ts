import { requireAdmin } from "@app/core";
import { getIdeaImageUrl } from "@app/ideas";
import { presignGet } from "@app/storage";
import { getCard } from "@app/tcg";
import { errorResponse } from "@/lib/route";

/**
 * Illustration d'une carte : admin uniquement, redirection vers une URL présignée valable 5 min.
 * Sans illustration propre, la carte montre l'image de l'idée dont elle vient.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const admin = await requireAdmin(request.headers);
    const card = await getCard(admin, (await params).id);
    const url = card?.imageKey
      ? await presignGet({ key: card.imageKey, expiresIn: 300 })
      : card?.ideaId
        ? await getIdeaImageUrl(admin, card.ideaId)
        : null;
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
