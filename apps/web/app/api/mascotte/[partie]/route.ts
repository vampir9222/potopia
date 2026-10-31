import { requireMember } from "@app/core";
import { presignGet } from "@app/storage";
import { mascotKey, mascotPartSchema } from "@/lib/mascot";
import { errorResponse } from "@/lib/route";

/**
 * Image de la mascotte (corps ou couronne) : réservée aux membres, redirection vers une URL
 * présignée (15 min), gardée 10 min par le navigateur. Tant qu'aucune image n'a été envoyée, le
 * stockage répond 404 et le composant Mascot affiche son icône de secours.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ partie: string }> },
): Promise<Response> {
  try {
    await requireMember(request.headers);
    const part = mascotPartSchema.safeParse((await params).partie);
    if (!part.success) return Response.json({ error: "Introuvable." }, { status: 404 });
    const url = await presignGet({ key: mascotKey(part.data), expiresIn: 900 });
    return new Response(null, {
      status: 302,
      headers: { location: url, "cache-control": "private, max-age=600" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
