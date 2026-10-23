import { getUsersByIds, requireAdmin } from "@app/core";
import { exportIdeas } from "@app/ideas";
import { errorResponse } from "@/lib/route";

/**
 * Export de toutes les idées en JSON (fichier téléchargé) : admin uniquement. Les liens d'image
 * sont des URL présignées valables 15 min.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin(request.headers);
    const ideas = await exportIdeas(admin);
    const authors = await getUsersByIds([...new Set(ideas.map((i) => i.authorId))]);
    const names = new Map(authors.map((u) => [u.id, u.name]));
    const exportedAt = new Date();

    const body = {
      exportedAt: exportedAt.toISOString(),
      count: ideas.length,
      ideas: ideas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description,
        effectIdea: idea.effectIdea,
        suggestedRarity: idea.suggestedRarity,
        concernedPeople: idea.concernedPeople,
        author: names.get(idea.authorId) ?? "Membre inconnu",
        createdAt: idea.createdAt.toISOString(),
        imageUrl: idea.imageUrl,
      })),
    };

    const day = exportedAt.toISOString().slice(0, 10);
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="idees-${day}.json"`,
        // Contenu réservé aux admins, avec des URL qui expirent : jamais en cache.
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
