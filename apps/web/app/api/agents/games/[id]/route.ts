import { getGame, playMove } from "@app/agents";
import { requireMember } from "@app/core";
import { errorResponse, json } from "@/lib/route";

type Params = { params: Promise<{ id: string }> };

/** Agents Doubles : la partie vue par le joueur (jamais la carte du partenaire avant la fin). */
export async function GET(request: Request, { params }: Params): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    return json(await getGame({ userId: user.id, gameId: (await params).id }));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Un coup : indice, mot touché, fin du tour ou abandon. Les règles sont appliquées par le jeu. */
export async function POST(request: Request, { params }: Params): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const move = await request.json().catch(() => ({}));
    return json(await playMove({ userId: user.id, gameId: (await params).id, move }));
  } catch (error) {
    return errorResponse(error);
  }
}
