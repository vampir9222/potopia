import {
  avatarConfigSchema,
  checkConfig,
  composeSheet,
  configHash,
  fitConfig,
  randomConfig,
  type AvatarConfig,
  type SpriteLoader,
} from "@app/avatar";
import { encodePng } from "@app/avatar/server";
import { catalog, palettes } from "@app/avatar-assets";
import { db, withTx, type DbTx, type Prisma } from "@app/db";
import { deleteObject, headObject, presignGet, putObject } from "@app/storage";
import { publishEvent } from "./activity";
import { AvatarConfigError } from "./errors";

export type Avatar = {
  userId: string;
  config: AvatarConfig;
  configHash: string;
  sheetKey: string;
  updatedAt: Date;
};

/** La planche ne change jamais pour une clé donnée (l'empreinte est dans le nom). */
const SHEET_CACHE_CONTROL = "private, max-age=31536000, immutable";

/** Validité de l'URL présignée d'une planche (s). La redirection est mise en cache moins longtemps. */
export const SHEET_URL_TTL = 900;

export function sheetKeyFor(userId: string, hash: string): string {
  return `avatars/${userId}-${hash}.png`;
}

function toAvatar(row: {
  userId: string;
  config: Prisma.JsonValue;
  configHash: string;
  sheetKey: string;
  updatedAt: Date;
}): Avatar {
  return { ...row, config: row.config as AvatarConfig };
}

export async function getAvatar(userId: string): Promise<Avatar | null> {
  const row = await db.avatar.findUnique({ where: { userId } });
  return row ? toAvatar(row) : null;
}

export async function getAvatarsByUserIds(ids: readonly string[]): Promise<Avatar[]> {
  if (ids.length === 0) return [];
  const rows = await db.avatar.findMany({ where: { userId: { in: [...new Set(ids)] } } });
  return rows.map(toAvatar);
}

/**
 * URL présignée de la planche courante d'un membre, ou null si l'empreinte demandée n'est pas (ou
 * plus) la sienne. Les droits (membre connecté) sont contrôlés par l'appelant.
 */
export async function getAvatarSheetUrl(userId: string, hash: string): Promise<string | null> {
  const avatar = await db.avatar.findUnique({
    where: { userId },
    select: { configHash: true, sheetKey: true },
  });
  if (!avatar || avatar.configHash !== hash) return null;
  return presignGet({ key: avatar.sheetKey, expiresIn: SHEET_URL_TTL });
}

/** Éléments d'avatar débloqués par le membre (aucun pour l'instant : tout est « free »). */
export async function listOwnedAvatarItems(
  userId: string,
  opts?: { tx?: DbTx },
): Promise<Set<string>> {
  const rows = await (opts?.tx ?? db).userAvatarItem.findMany({
    where: { userId },
    select: { itemId: true },
  });
  return new Set(rows.map((r) => r.itemId));
}

/**
 * Valide une config reçue du client : forme (zod), puis cohérence avec le catalogue (éléments
 * existants, compatibles avec la morphologie, couleurs des palettes, éléments débloqués).
 */
export async function validateAvatarConfig(
  userId: string,
  input: unknown,
  opts?: { tx?: DbTx },
): Promise<AvatarConfig> {
  const parsed = avatarConfigSchema.safeParse(input);
  if (!parsed.success) throw new AvatarConfigError(["Avatar invalide."]);
  const config = parsed.data as AvatarConfig;
  const issues = checkConfig(config, catalog, palettes, await listOwnedAvatarItems(userId, opts));
  if (issues.length > 0) throw new AvatarConfigError(issues);
  return config;
}

/** Compose la planche et l'envoie dans R2 (sauf si elle y est déjà). */
async function uploadSheet(key: string, config: AvatarConfig, sprites: SpriteLoader) {
  if (await headObject(key)) return;
  const sheet = await composeSheet(config, catalog, palettes, sprites);
  await putObject({
    key,
    body: await encodePng(sheet),
    contentType: "image/png",
    cacheControl: SHEET_CACHE_CONTROL,
  });
}

/**
 * Enregistre l'avatar d'un membre : validation, composition de la planche, envoi dans R2, puis
 * mise à jour en base et événement « avatar/updated ». Sans effet si rien n'a changé.
 * `sprites` charge les PNG du catalogue (côté serveur : `fsSpriteLoader` de @app/avatar/server).
 */
export async function saveAvatar(
  input: { userId: string; config: unknown; sprites: SpriteLoader },
  opts?: { tx?: DbTx },
): Promise<Avatar> {
  const { userId, sprites } = input;
  const config = await validateAvatarConfig(userId, input.config, opts);
  const hash = await configHash(config, catalog);
  const previous = await (opts?.tx ?? db).avatar.findUnique({ where: { userId } });
  if (previous?.configHash === hash) return toAvatar(previous);

  const sheetKey = sheetKeyFor(userId, hash);
  await uploadSheet(sheetKey, config, sprites);

  const saved = await withTx(async (tx) => {
    const data = { config: config as Prisma.InputJsonObject, configHash: hash, sheetKey };
    const row = await tx.avatar.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    await publishEvent({ userId, app: "avatar", type: "updated", payload: {} }, { tx });
    return row;
  }, opts);

  // Ancienne planche : plus servie. Supprimée seulement hors transaction externe (sinon on ne sait
  // pas si l'enregistrement sera validé).
  if (previous && previous.sheetKey !== sheetKey && !opts?.tx) {
    await deleteObject(previous.sheetKey).catch(() => undefined);
  }
  return toAvatar(saved);
}

/**
 * Garantit qu'un membre a un avatar à jour, appelé à chaque affichage du dashboard :
 * - première visite : avatar aléatoire mais cohérent (sans événement d'activité) ;
 * - catalogue réimporté (empreinte différente) : la planche est recomposée, la config ajustée si
 *   un élément a disparu.
 */
export async function ensureAvatar(
  input: { userId: string; sprites: SpriteLoader },
  opts?: { tx?: DbTx },
): Promise<Avatar> {
  const { userId, sprites } = input;
  const client = opts?.tx ?? db;
  const current = await client.avatar.findUnique({ where: { userId } });
  if (current) {
    const config = current.config as AvatarConfig;
    if (current.configHash === (await configHash(config, catalog))) return toAvatar(current);
  }

  const owned = await listOwnedAvatarItems(userId, opts);
  let config = current ? fitConfig(current.config as AvatarConfig, catalog) : undefined;
  if (!config || checkConfig(config, catalog, palettes, owned).length > 0) {
    config = randomConfig(catalog, palettes);
  }
  const hash = await configHash(config, catalog);
  const sheetKey = sheetKeyFor(userId, hash);
  await uploadSheet(sheetKey, config, sprites);

  const data = { config: config as Prisma.InputJsonObject, configHash: hash, sheetKey };
  if (current) {
    await client.avatar.update({ where: { userId }, data });
  } else {
    // Deux premières visites simultanées : la première écriture gagne.
    await client.avatar.createMany({ data: [{ userId, ...data }], skipDuplicates: true });
  }
  return toAvatar(await client.avatar.findUniqueOrThrow({ where: { userId } }));
}

export type PlaceMember = {
  userId: string;
  name: string;
  configHash: string;
  /** Dernière activité : dernier événement ou dernière session, au plus récent. */
  lastSeenAt: Date;
};

/** Membres qui ont un avatar, pour la place du dashboard. */
export async function listPlaceMembers(): Promise<PlaceMember[]> {
  const rows = await db.$queryRaw<
    { user_id: string; name: string; config_hash: string; last_seen_at: Date }[]
  >`
    SELECT a."user_id", u."name", a."config_hash",
      GREATEST(
        u."created_at",
        (SELECT MAX(e."created_at") FROM "core"."activity_events" e WHERE e."user_id" = a."user_id"),
        (SELECT MAX(s."updated_at") FROM "core"."sessions" s WHERE s."user_id" = a."user_id")
      ) AS "last_seen_at"
    FROM "core"."avatars" a
    JOIN "core"."users" u ON u."id" = a."user_id"
    ORDER BY u."name"`;
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    configHash: r.config_hash,
    lastSeenAt: r.last_seen_at,
  }));
}

/**
 * Crée l'avatar aléatoire des membres qui n'en ont pas encore (inscrits avant les avatars, ou pas
 * revenus depuis), quelques-uns à la fois pour ne pas ralentir la requête qui s'en charge.
 */
export async function ensureMissingAvatars(input: {
  sprites: SpriteLoader;
  limit?: number;
}): Promise<number> {
  const users = await db.user.findMany({
    where: { avatar: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: input.limit ?? 5,
  });
  for (const user of users) await ensureAvatar({ userId: user.id, sprites: input.sprites });
  return users.length;
}
