import { getUsersByIds, requireAdmin } from "@app/core";
import { DESIGNS, listDesignVotes } from "@app/tcg";
import { errorResponse } from "@/lib/route";

/** Export des notes sur les propositions de design de carte, en JSON (fichier) : admin uniquement. */
export async function GET(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin(request.headers);
    const votes = await listDesignVotes(admin);
    const users = await getUsersByIds([...new Set(votes.map((v) => v.userId))]);
    const names = new Map(users.map((u) => [u.id, u.name]));
    const exportedAt = new Date();

    const body = {
      exportedAt: exportedAt.toISOString(),
      designs: DESIGNS.map((design) => {
        const forDesign = votes.filter((v) => v.designId === design.id);
        const average = forDesign.length
          ? Math.round((forDesign.reduce((sum, v) => sum + v.stars, 0) / forDesign.length) * 10) /
            10
          : null;
        return {
          id: design.id,
          title: design.title,
          average,
          votes: forDesign.map((v) => ({
            author: names.get(v.userId) ?? "Membre inconnu",
            stars: v.stars,
            comment: v.comment,
            updatedAt: v.updatedAt.toISOString(),
          })),
        };
      }),
    };

    const day = exportedAt.toISOString().slice(0, 10);
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="notes-cartes-${day}.json"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
