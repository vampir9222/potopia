import { createHash } from "node:crypto";
import { db, withTx, type DbTx } from "@app/db";
import { z } from "zod";
import { resolveActor } from "./access";
import { GotyError } from "./errors";
import { id, parse } from "./validation";

const catalogGame = z.object({
  igdbId: z.number().int().positive(),
  title: z.string().min(1).max(200),
  cover: z.string().nullable(),
  platforms: z.array(z.string()),
  trailerYoutubeId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{11}$/)
    .nullable(),
});
const cachedGames = z.array(catalogGame).max(12);
export type CatalogGame = z.infer<typeof catalogGame>;
const providerGames = z
  .array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(200),
      cover: z.object({ image_id: z.string().regex(/^[a-zA-Z0-9_-]+$/) }).nullish(),
      platforms: z.array(z.object({ name: z.string() })).nullish(),
      videos: z
        .array(z.object({ name: z.string().nullish(), video_id: z.string().nullish() }))
        .nullish(),
    }),
  )
  .max(12);
const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});
let token: { fingerprint: string; value: string; expiresAt: number } | undefined;
let pendingToken: { fingerprint: string; promise: Promise<string> } | undefined;
const unavailable = () =>
  new GotyError(
    "CATALOG_UNAVAILABLE",
    "Le catalogue est temporairement indisponible. Tu peux saisir ton jeu manuellement.",
    503,
  );

export function selectTrailer(
  videos: readonly { name?: string | null; video_id?: string | null }[],
): string | null {
  const priority = (name: string) =>
    /launch|release|lancement/i.test(name) ? 0 : /trailer|bande[ -]annonce/i.test(name) ? 1 : 2;
  return (
    [...videos]
      .filter(
        (video) =>
          /^[a-zA-Z0-9_-]{11}$/.test(video.video_id ?? "") &&
          /trailer|teaser|bande[ -]annonce/i.test(video.name ?? ""),
      )
      .sort(
        (a, b) =>
          priority(a.name ?? "") - priority(b.name ?? "") ||
          (a.video_id ?? "").localeCompare(b.video_id ?? ""),
      )[0]?.video_id ?? null
  );
}

async function getToken(clientId: string, secret: string) {
  const fingerprint = createHash("sha256")
    .update(clientId)
    .update("\0")
    .update(secret)
    .digest("hex");
  if (token?.fingerprint === fingerprint && token.expiresAt > Date.now()) return token.value;
  if (pendingToken?.fingerprint === fingerprint) return pendingToken.promise;
  const promise = (async () => {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
    });
    if (!response.ok) throw unavailable();
    const credentials = tokenSchema.safeParse(await response.json());
    if (!credentials.success) throw unavailable();
    token = {
      fingerprint,
      value: credentials.data.access_token,
      expiresAt: Date.now() + Math.max(0, credentials.data.expires_in - 60) * 1000,
    };
    return token.value;
  })();
  pendingToken = { fingerprint, promise };
  try {
    return await promise;
  } finally {
    if (pendingToken?.promise === promise) pendingToken = undefined;
  }
}

async function consumeQuota(tx: DbTx, scope: string, limit: number, interval: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`goty:catalog:${scope}`}, 0))`;
  const quota = await tx.gotyCatalogQuota.findUnique({ where: { scope } });
  const now = new Date();
  if (quota && now.getTime() - quota.startedAt.getTime() < interval && quota.count >= limit)
    throw new GotyError(
      "RATE_LIMITED",
      "Trop de recherches. Réessaie dans un instant, ou saisis le jeu manuellement.",
      429,
    );
  const fresh = !quota || now.getTime() - quota.startedAt.getTime() >= interval;
  await tx.gotyCatalogQuota.upsert({
    where: { scope },
    create: { scope, startedAt: now, count: 1 },
    update: fresh ? { startedAt: now, count: 1 } : { count: { increment: 1 } },
  });
}

/** Cache PostgreSQL partagé, jamais un cache de jetons OAuth. Appel après contrôle de session. */
export async function searchCatalog(
  input: { actorId: string; query: string },
  opts?: { tx?: DbTx },
) {
  const data = parse(z.object({ actorId: id, query: z.string().trim().min(2).max(80) }), input);
  await resolveActor(data.actorId);
  const clientId = process.env.IGDB_CLIENT_ID?.trim();
  const secret = process.env.IGDB_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return { games: [] as CatalogGame[], available: false };
  const query = data.query
    .replace(/["\\;\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (query.length < 2)
    throw new GotyError("INVALID_INPUT", "Saisis au moins deux caractères de recherche.", 400);
  const key = createHash("sha256").update(query.toLowerCase()).digest("hex");
  // Réserver la tentative membre séparément : même un refus fournisseur compte.
  await withTx((tx) => consumeQuota(tx, `member:${data.actorId}`, 30, 60000), opts);
  const cached = await withTx(async (tx) => {
    const entry = await tx.gotyCatalogCache.findUnique({ where: { key } });
    const parsed =
      entry && entry.expiresAt.getTime() > Date.now() ? cachedGames.safeParse(entry.games) : null;
    if (parsed?.success) return parsed.data;
    await consumeQuota(tx, "provider", 4, 1000);
    return null;
  }, opts);
  if (cached !== null) return { games: cached, available: true };
  let games: CatalogGame[];
  try {
    const accessToken = await getToken(clientId, secret);
    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain",
      },
      body: `search "${query}"; fields name,cover.image_id,platforms.name,videos.name,videos.video_id; limit 12;`,
    });
    if (response.status === 401) token = undefined;
    if (!response.ok) throw unavailable();
    const parsed = providerGames.safeParse(await response.json());
    if (!parsed.success) throw unavailable();
    games = parsed.data.map((row) => ({
      igdbId: row.id,
      title: row.name,
      cover: row.cover
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${row.cover.image_id}.jpg`
        : null,
      platforms: row.platforms?.map((p) => p.name) ?? [],
      trailerYoutubeId: selectTrailer(row.videos ?? []),
    }));
  } catch {
    throw unavailable();
  }
  const client = opts?.tx ?? db;
  await client.gotyCatalogCache.upsert({
    where: { key },
    create: { key, games, expiresAt: new Date(Date.now() + 3600000) },
    update: { games, expiresAt: new Date(Date.now() + 3600000) },
  });
  await client.gotyCatalogCache.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return { games, available: true };
}
