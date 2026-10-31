import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { getStorage, type Storage } from "./client";

// URLs courtes : 5 min par défaut, 15 min au plus.
export const DEFAULT_EXPIRES_IN = 300;
export const MAX_EXPIRES_IN = 900;

/** Clé d'objet générée côté serveur : segments `[a-z0-9._-]` séparés par `/`, sans `..`. */
const keySchema = z
  .string()
  .max(512)
  .regex(/^[a-z0-9._-]+(\/[a-z0-9._-]+)*$/i, "Clé d'objet invalide.")
  .refine((key) => !key.split("/").includes(".."), "Clé d'objet invalide.");

const expiresInSchema = z.number().int().min(1).max(MAX_EXPIRES_IN).default(DEFAULT_EXPIRES_IN);

const presignPutInput = z.object({
  key: keySchema,
  contentType: z.string().min(1).max(100),
  contentLength: z.number().int().positive(),
  expiresIn: expiresInSchema,
});

/**
 * URL PUT présignée. Content-Type et Content-Length font partie de la signature :
 * le navigateur doit envoyer exactement ce type et cette taille, sinon le stockage refuse.
 */
export async function presignPut(
  input: z.input<typeof presignPutInput>,
  storage: Storage = getStorage(),
): Promise<string> {
  const { key, contentType, contentLength, expiresIn } = presignPutInput.parse(input);
  const command = new PutObjectCommand({
    Bucket: storage.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(storage.s3, command, {
    expiresIn,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

const presignGetInput = z.object({ key: keySchema, expiresIn: expiresInSchema });

export async function presignGet(
  input: z.input<typeof presignGetInput>,
  storage: Storage = getStorage(),
): Promise<string> {
  const { key, expiresIn } = presignGetInput.parse(input);
  return getSignedUrl(storage.s3, new GetObjectCommand({ Bucket: storage.bucket, Key: key }), {
    expiresIn,
  });
}

/** Fenêtre des URLs stables : la même URL sert pendant 5 min. */
export const STABLE_WINDOW = 300;

/**
 * URL GET présignée identique pendant toute une fenêtre de 5 min (signée au début de la fenêtre,
 * valable 15 min, donc encore au moins 10 min après l'appel). Le navigateur garde ainsi l'image en
 * cache d'une page à l'autre au lieu de la retélécharger, ce qu'une URL toujours nouvelle empêche.
 */
export async function presignGetStable(
  key: string,
  storage: Storage = getStorage(),
  now: number = Date.now(),
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: storage.bucket,
    Key: keySchema.parse(key),
    // La clé change à chaque nouvel envoi : le contenu derrière une URL ne change jamais.
    ResponseCacheControl: `private, max-age=${MAX_EXPIRES_IN - STABLE_WINDOW}`,
  });
  return getSignedUrl(storage.s3, command, {
    expiresIn: MAX_EXPIRES_IN,
    signingDate: new Date(now - (now % (STABLE_WINDOW * 1000))),
  });
}

export type ObjectInfo = { contentType: string | null; contentLength: number };

/** Métadonnées d'un objet, ou null s'il n'existe pas. */
export async function headObject(
  key: string,
  storage: Storage = getStorage(),
): Promise<ObjectInfo | null> {
  try {
    const res = await storage.s3.send(
      new HeadObjectCommand({ Bucket: storage.bucket, Key: keySchema.parse(key) }),
    );
    return { contentType: res.ContentType ?? null, contentLength: res.ContentLength ?? 0 };
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return null;
    throw error;
  }
}

const putObjectInput = z.object({
  key: keySchema,
  body: z.custom<Uint8Array<ArrayBufferLike>>((value) => value instanceof Uint8Array),
  contentType: z.string().min(1).max(100),
  cacheControl: z.string().max(200).optional(),
});

/** Envoi direct depuis le serveur (contenu produit par le serveur lui-même, jamais par un client). */
export async function putObject(
  input: z.input<typeof putObjectInput>,
  storage: Storage = getStorage(),
): Promise<void> {
  const { key, body, contentType, cacheControl } = putObjectInput.parse(input);
  await storage.s3.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
      CacheControl: cacheControl,
    }),
  );
}

/** Supprime un objet (sans erreur s'il n'existe pas). */
export async function deleteObject(key: string, storage: Storage = getStorage()): Promise<void> {
  await storage.s3.send(
    new DeleteObjectCommand({ Bucket: storage.bucket, Key: keySchema.parse(key) }),
  );
}
