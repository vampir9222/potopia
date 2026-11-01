import { requireMember } from "@app/core";
import {
  addCategory,
  addGames,
  controlEdition,
  controlInputSchema,
  createEdition,
  deleteGame,
  getEdition,
  getMemberSnapshot,
  getPresentationSnapshot,
  GotyError,
  IMPORT_MAX_BYTES,
  listEditions,
  listEligibleMembers,
  prepareEdition,
  previewGameImport,
  searchCatalog,
  setChoice,
  setEditionMembers,
  setPrediction,
  setRoundOrder,
  setTopOrder,
  updateGame,
  voteCategory,
  proposeCategory,
} from "@app/goty";
import { z } from "zod";
import { gotyError, readGotyBody, requireGotyOrigin } from "@/lib/goty-http";
import { json } from "@/lib/route";

type Context = { params: Promise<{ path: string[] }> };
const revision = (
  view: Awaited<ReturnType<typeof getEdition>>,
  tv: boolean,
  viewer: string,
  role: string,
) =>
  `"${view.edition.version}-${viewer}-${tv ? "tv" : `${role}-${Number(view.permissions.organize)}${Number(view.permissions.present)}${Number(view.permissions.participate)}`}"`;

async function handle(request: Request, context: Context): Promise<Response> {
  try {
    const user = await requireMember(request.headers);
    const path = (await context.params).path;
    const method = request.method;
    const url = new URL(request.url);
    if (method !== "GET") requireGotyOrigin(request);
    if (method === "GET" && path.length === 1 && path[0] === "catalog")
      return json(
        await searchCatalog({ actorId: user.id, query: url.searchParams.get("q") ?? "" }),
      );
    if (path[0] !== "editions")
      return json({ error: { code: "NOT_FOUND", message: "Route introuvable." } }, { status: 404 });
    if (path.length === 1 && method === "GET")
      return json({ editions: await listEditions(user.id) });
    const editionId = path[1] ?? "";
    const actor = { actorId: user.id, editionId };
    const resource = path[2];
    if (
      method === "GET" &&
      (path.length === 2 || (path.length === 3 && resource === "presentation"))
    ) {
      const tv = resource === "presentation";
      const summary = await getEdition(actor);
      const tag = revision(summary, tv, user.id, user.role);
      const viewerHeaders: Record<string, string> = { "x-goty-viewer": user.id };
      if (!tv) viewerHeaders["x-goty-admin"] = String(user.role === "admin");
      if (request.headers.get("if-none-match") === tag)
        return new Response(null, {
          status: 304,
          headers: { "cache-control": "private, no-store", etag: tag, ...viewerHeaders },
        });
      const snapshot = tv ? await getPresentationSnapshot(actor) : await getMemberSnapshot(actor);
      return json(snapshot, {
        headers: {
          ...viewerHeaders,
          etag: tv
            ? revision({ ...summary, edition: snapshot.edition }, true, user.id, user.role)
            : revision(
                snapshot as Awaited<ReturnType<typeof getMemberSnapshot>>,
                false,
                user.id,
                user.role,
              ),
        },
      });
    }
    if (method === "GET" && path.length === 3 && resource === "eligible-members")
      return json({ members: await listEligibleMembers(actor) });
    if (method === "POST" && path.length === 3 && resource === "import-preview") {
      const view = await getEdition(actor);
      if (!view.permissions.participate)
        throw new GotyError("FORBIDDEN", "Réservé aux participants.", 403);
      if (!["categories", "preparation"].includes(view.edition.phase))
        throw new GotyError("CONFLICT", "Les listes de jeux sont figées.", 409);
      const format = z.enum(["csv", "xlsx"]).parse(url.searchParams.get("format"));
      const mapping = url.searchParams.has("mapping")
        ? z
            .record(z.string(), z.number())
            .parse(JSON.parse(url.searchParams.get("mapping") ?? "{}"))
        : undefined;
      return json(
        await previewGameImport({
          format,
          data: await readGotyBody(request, IMPORT_MAX_BYTES),
          mapping,
        }),
      );
    }
    if (method === "DELETE" && resource === "games" && path.length === 4)
      return json(await deleteGame({ ...actor, gameId: path[3] ?? "" }));
    if (method === "GET" || method === "DELETE")
      return json({ error: { code: "NOT_FOUND", message: "Route introuvable." } }, { status: 404 });
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new GotyError("INVALID_INPUT", "Un contenu JSON est attendu.", 400);
    const body = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(new TextDecoder().decode(await readGotyBody(request, 2 * 1024 * 1024))));
    // L'acteur de session écrase systématiquement tout identifiant fourni par le navigateur.
    const input = { ...body, ...actor };
    if (path.length === 1 && method === "POST")
      return json(
        await createEdition({
          ...z.object({ year: z.number(), name: z.string() }).parse(body),
          actorId: user.id,
        }),
        { status: 201 },
      );
    if (path.length === 3) {
      if (resource === "members" && method === "PUT")
        return json(
          await setEditionMembers({
            ...z
              .object({
                expectedVersion: z.number(),
                members: z.array(
                  z.object({ userId: z.string(), organizer: z.boolean(), presenter: z.boolean() }),
                ),
              })
              .parse(body),
            ...actor,
          }),
        );
      if (resource === "prepare" && method === "POST")
        return json(
          await prepareEdition({
            ...actor,
            expectedVersion: z.number().parse(body.expectedVersion),
          }),
        );
      if (resource === "proposals" && method === "POST")
        return json(await proposeCategory({ ...actor, name: z.string().parse(body.name) }), {
          status: 201,
        });
      if (resource === "rounds" && method === "POST")
        return json(await addCategory({ ...actor, name: z.string().parse(body.name) }), {
          status: 201,
        });
      if (resource === "games" && method === "POST")
        return json(
          await addGames({
            ...actor,
            games: z.array(z.object({ title: z.string() }).passthrough()).parse(body.games),
          }),
          { status: 201 },
        );
      if (resource === "top" && method === "PUT")
        return json(
          await setTopOrder({ ...actor, gameIds: z.array(z.string()).parse(body.gameIds) }),
        );
      if (resource === "order" && method === "PUT")
        return json(
          await setRoundOrder({
            ...actor,
            ...z.object({ expectedVersion: z.number(), roundIds: z.array(z.string()) }).parse(body),
          }),
        );
      if (resource === "control" && method === "POST")
        return json(await controlEdition(controlInputSchema.parse(input)));
    }
    if (resource === "games" && path.length === 4 && method === "PATCH")
      return json(
        await updateGame({
          ...actor,
          gameId: path[3] ?? "",
          game: z.object({ title: z.string() }).passthrough().parse(body),
        }),
      );
    if (resource === "choices" && path.length === 4 && method === "PUT")
      return json(
        await setChoice({
          ...actor,
          roundId: path[3] ?? "",
          ...z
            .object({
              gameId: z.string().nullable(),
              precision: z.string().optional(),
              youtube: z.string().nullable().optional(),
            })
            .parse(body),
        }),
      );
    if (resource === "predictions" && path.length === 5 && method === "PUT")
      return json(
        await setPrediction({
          ...actor,
          roundId: path[3] ?? "",
          targetId: path[4] ?? "",
          gameId: z.string().nullable().parse(body.gameId),
        }),
      );
    if (resource === "proposals" && path.length === 5 && path[4] === "vote" && method === "PUT")
      return json(
        await voteCategory({
          ...actor,
          proposalId: path[3] ?? "",
          favor: z.boolean().parse(body.favor),
        }),
      );
    return json({ error: { code: "NOT_FOUND", message: "Route introuvable." } }, { status: 404 });
  } catch (error) {
    return gotyError(error);
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
