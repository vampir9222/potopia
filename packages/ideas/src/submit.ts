import { randomUUID } from "node:crypto";
import { notifyAdmins, publishEvent } from "@app/core";
import { db, withTx, type DbTx } from "@app/db";
import { headObject, presignPut } from "@app/storage";
import { InvalidImageError } from "./errors";
import {
  IMAGE_TYPES,
  ideaInput,
  LIMITS,
  uploadInput,
  type IdeaInput,
  type UploadInput,
} from "./validation";

// Durée de validité de l'URL PUT : le navigateur envoie l'image juste après l'avoir obtenue.
const UPLOAD_URL_TTL = 300;

/**
 * Autorise l'envoi d'une image : clé générée ici (`ideas/<uuid>.<ext>`), enregistrée pour ce
 * membre, puis URL PUT présignée qui impose le type et la taille annoncés.
 */
export async function createUploadUrl(
  userId: string,
  input: UploadInput,
  opts?: { tx?: DbTx },
): Promise<{ key: string; url: string }> {
  const { contentType, size } = uploadInput.parse(input);
  const key = `ideas/${randomUUID()}.${IMAGE_TYPES[contentType]}`;

  await withTx(async (tx) => {
    await tx.ideaUpload.create({ data: { key, userId, contentType, size } });
  }, opts);

  const url = await presignPut({
    key,
    contentType,
    contentLength: size,
    expiresIn: UPLOAD_URL_TTL,
  });
  return { key, url };
}

/** Vérifie qu'une clé a été émise pour ce membre, jamais utilisée, et que l'objet est conforme. */
async function claimImage(tx: DbTx, userId: string, key: string): Promise<void> {
  const [upload] = await tx.$queryRaw<
    { user_id: string; content_type: string; size: number; used_at: Date | null }[]
  >`SELECT "user_id", "content_type", "size", "used_at" FROM "ideas"."idea_uploads"
    WHERE "key" = ${key} FOR UPDATE`;
  if (!upload || upload.user_id !== userId || upload.used_at) throw new InvalidImageError();

  const object = await headObject(key);
  if (!object) throw new InvalidImageError("Image introuvable : l'envoi n'a pas abouti.");
  if (object.contentLength !== upload.size || object.contentLength > LIMITS.imageBytes) {
    throw new InvalidImageError();
  }

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
