import { getAvatarSheetUrl, requireMember } from "@app/core";
import { errorResponse } from "@/lib/route";

/**
 * Planche d'avatar d'un membre : réservée aux membres, redirection vers une URL présignée (15 min).
 * La redirection est gardée 10 min par le navigateur ; l'objet lui-même est immuable (empreinte
 * dans le nom), donc une nouvelle planche a toujours une nouvelle URL.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string; hash: string }> },
): Promise<Response> {
  try {
    await requireMember(request.headers);
    const { userId, hash } = await params;
    if (!/^[0-9a-f]{16}$/.test(hash))
      return Response.json({ error: "Introuvable." }, { status: 404 });
    const url = await getAvatarSheetUrl(userId, hash);
    if (!url) return Response.json({ error: "Introuvable." }, { status: 404 });
    return new Response(null, {
      status: 302,
      headers: { location: url, "cache-control": "private, max-age=600" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
