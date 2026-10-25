import { randomUUID } from "node:crypto";
import { notifyAdmins, publishEvent } from "@app/core";
import { db, withTx, type DbTx } from "@app/db";
import { deleteObject, headObject, presignPut } from "@app/storage";
import { InvalidImageError, UploadRateLimitError } from "./errors";
import {
  IMAGE_TYPES,
  ideaInput,
  uploadInput,
  type IdeaInput,
  type UploadInput,
} from "./validation";

// Durée de validité de l'URL PUT : le navigateur envoie l'image juste après l'avoir obtenue.
const UPLOAD_URL_TTL = 300;

/** Demandes d'URL d'envoi par membre sur une heure glissante (comptées sur idea_uploads). */
export const UPLOAD_RATE_LIMIT = 30;
const UPLOAD_RATE_WINDOW = "1 hour";

/** Espace des verrous consultatifs du module (clé 1 du verrou à deux clés). */
const UPLOAD_LOCK_NAMESPACE = 6_032_001;

/** Un upload jamais utilisé est supprimé (objet puis ligne) au-delà de cet âge. */
export const STALE_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Uploads périmés traités par demande d'URL (purge opportuniste). */
export const STALE_UPLOAD_PURGE_BATCH = 20;
/** Marge pour la suppression d'un objet dans le stockage pendant la transaction de purge. */
const PURGE_TX_TIMEOUT_MS = 15_000;

/**
 * Autorise l'envoi d'une image : clé générée ici (`ideas/<uuid>.<ext>`), enregistrée pour ce
 * membre, puis URL PUT présignée qui impose le type et la taille annoncés.
 * Au plus UPLOAD_RATE_LIMIT demandes par heure glissante et par membre (UploadRateLimitError
 * au-delà). Chaque demande purge au passage quelques uploads jamais utilisés.
 */
export async function createUploadUrl(
  userId: string,
  input: UploadInput,
  opts?: { tx?: DbTx },
): Promise<{ key: string; url: string }> {
  const { contentType, size } = uploadInput.parse(input);
  const key = `ideas/${randomUUID()}.${IMAGE_TYPES[contentType]}`;

  await withTx(async (tx) => {
    // Un verrou par membre, tenu jusqu'au commit : deux demandes simultanées se comptent l'une
    // l'autre.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${UPLOAD_LOCK_NAMESPACE}, hashtext(${userId}))`;
    const [row] = await tx.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS "count" FROM "ideas"."idea_uploads"
      WHERE "user_id" = ${userId} AND "created_at" > now() - ${UPLOAD_RATE_WINDOW}::interval`;
    if ((row?.count ?? 0) >= UPLOAD_RATE_LIMIT) throw new UploadRateLimitError();
    await tx.ideaUpload.create({ data: { key, userId, contentType, size } });
  }, opts);

  const url = await presignPut({
    key,
    contentType,
    contentLength: size,
    expiresIn: UPLOAD_URL_TTL,
  });

  // Purge opportuniste : jamais bloquante pour la demande en cours.
  await purgeStaleUploads(STALE_UPLOAD_PURGE_BATCH).catch((error: unknown) => {
    console.error("Purge des uploads périmés impossible :", error);
  });
  return { key, url };
}

/**
 * Supprime au plus `limit` uploads jamais utilisés de plus de STALE_UPLOAD_MAX_AGE_MS : la ligne
 * est retirée sous verrou (une soumission concurrente qui la réclame attend puis la trouve
 * absente), l'objet est supprimé du stockage dans la même transaction, qui est annulée si cette
 * suppression échoue (l'upload sera retenté à la purge suivante). Renvoie le nombre purgé.
 */
export async function purgeStaleUploads(limit = STALE_UPLOAD_PURGE_BATCH): Promise<number> {
  const stale = await db.ideaUpload.findMany({
    where: { usedAt: null, createdAt: { lt: new Date(Date.now() - STALE_UPLOAD_MAX_AGE_MS) } },
    select: { key: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(0, limit),
  });

  let purged = 0;
  for (const { key } of stale) {
    try {
      const done = await withTx(
        async (tx) => {
          const deleted = await tx.$executeRaw`
            DELETE FROM "ideas"."idea_uploads" WHERE "key" = ${key} AND "used_at" IS NULL`;
          if (deleted === 0) return false;
          await deleteObject(key);
          return true;
        },
        { timeout: PURGE_TX_TIMEOUT_MS },
      );
      if (done) purged++;
    } catch (error) {
      // Aucune information sur l'idée : la clé est un identifiant aléatoire.
      console.error(`Purge de l'upload ${key} impossible :`, error);
    }
  }
  return purged;
}

type UploadRow = { user_id: string; content_type: string; size: number; used_at: Date | null };

/** La ligne d'upload de `key`, si elle a été émise pour ce membre et jamais utilisée. */
function claimable(upload: UploadRow | undefined, userId: string): upload is UploadRow {
  return !!upload && upload.user_id === userId && !upload.used_at;
}

/**
 * Vérifie, hors transaction, qu'une clé a été émise pour ce membre, jamais utilisée, et que
 * l'objet envoyé est conforme (présent, type et taille annoncés). L'appel réseau au stockage
 * (HeadObject) reste ainsi hors du verrou et du délai de la transaction.
 */
async function checkImage(userId: string, key: string): Promise<void> {
  const upload = await db.ideaUpload.findUnique({
    where: { key },
    select: { userId: true, contentType: true, size: true, usedAt: true },
  });
  if (!upload || upload.userId !== userId || upload.usedAt) throw new InvalidImageError();

  const object = await headObject(key);
  if (!object) throw new InvalidImageError("Image introuvable : l'envoi n'a pas abouti.");
  // L'URL PUT signe type et taille : l'objet doit correspondre à ce qui a été annoncé (la taille
  // annoncée a déjà été bornée à LIMITS.imageBytes par uploadInput).
  if (object.contentLength !== upload.size || object.contentType !== upload.contentType) {
    throw new InvalidImageError();
  }
}

/** Marque la clé comme utilisée, sous verrou : revérifie qu'elle est toujours réclamable. */
async function claimImage(tx: DbTx, userId: string, key: string): Promise<void> {
  const [upload] = await tx.$queryRaw<UploadRow[]>`
    SELECT "user_id", "content_type", "size", "used_at" FROM "ideas"."idea_uploads"
    WHERE "key" = ${key} FOR UPDATE`;
  if (!claimable(upload, userId)) throw new InvalidImageError();
  await tx.ideaUpload.update({ where: { key }, data: { usedAt: new Date() } });
}

/**
 * Enregistre une idée. Boîte noire : ne renvoie que `{ ok: true }`, l'événement d'activité n'a
 * aucun contenu et la notification des admins non plus.
 */
export async function submitIdea(
  userId: string,
  input: IdeaInput,
  opts?: { tx?: DbTx },
): Promise<{ ok: true }> {
  const { imageKey, ...fields } = ideaInput.parse(input);
  if (imageKey) await checkImage(userId, imageKey);

  await withTx(async (tx) => {
    if (imageKey) await claimImage(tx, userId, imageKey);

    await tx.idea.create({ data: { ...fields, authorId: userId, imageKey } });
    await publishEvent({ userId, app: "ideas", type: "idea_submitted", payload: {} }, { tx });
    await notifyAdmins({ title: "Nouvelle idée reçue", link: "/admin/ideas" }, { tx });
  }, opts);

  return { ok: true };
}

/** Nombre d'idées reçues, pour l'accueil admin. Ne dit rien de leur contenu. */
export async function countIdeas(): Promise<number> {
  return db.idea.count();
}
