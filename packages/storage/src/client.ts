import { S3Client } from "@aws-sdk/client-s3";

export type StorageConfig = {
  accountId?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Endpoint S3 explicite (stockage local) ; sinon l'endpoint R2 du compte. */
  endpoint?: string;
};

export type Storage = {
  s3: S3Client;
  bucket: string;
};

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} n'est pas définie.`);
  return value;
}

/** Lit la config R2_* de l'env. Avec R2_ENDPOINT (stockage local), R2_ACCOUNT_ID est inutile. */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const endpoint = env.R2_ENDPOINT || undefined;
  return {
    accountId: endpoint ? env.R2_ACCOUNT_ID : requireEnv(env, "R2_ACCOUNT_ID"),
    accessKeyId: requireEnv(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(env, "R2_SECRET_ACCESS_KEY"),
    bucket: requireEnv(env, "R2_BUCKET"),
    endpoint,
  };
}

export function createR2Client(config: StorageConfig = configFromEnv()): Storage {
  const endpoint = config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`;
  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Le stockage local n'a pas de sous-domaine par bucket : URLs en `endpoint/bucket/clé`.
    forcePathStyle: Boolean(config.endpoint),
    // R2 ne gère pas les checksums CRC ajoutés par défaut, qui casseraient aussi les PUT présignés.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { s3, bucket: config.bucket };
}

const globalForStorage = globalThis as unknown as { __appStorage?: Storage };

/** Client partagé, créé au premier usage (l'env n'est lu qu'à ce moment). */
export function getStorage(): Storage {
  globalForStorage.__appStorage ??= createR2Client();
  return globalForStorage.__appStorage;
}
