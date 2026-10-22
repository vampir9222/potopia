import { fileURLToPath } from "node:url";
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { configFromEnv, createR2Client, type StorageConfig } from "../src/client";

/**
 * Stockage local uniquement : crée le bucket s'il n'existe pas et autorise le PUT depuis
 * le navigateur (CORS). En prod, bucket et CORS se configurent dans le dashboard R2.
 */
export async function initLocalBucket(config: StorageConfig, allowedOrigin: string): Promise<void> {
  if (!config.endpoint) throw new Error("storage:init ne sert qu'au stockage local (R2_ENDPOINT).");
  const { s3, bucket } = createR2Client(config);
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [allowedOrigin],
            AllowedMethods: ["PUT", "GET"],
            AllowedHeaders: ["content-type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
  } catch {
    // Pas de .env : les variables viennent de l'environnement.
  }
  const config = configFromEnv();
  await initLocalBucket(config, process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
  console.log(`Bucket « ${config.bucket} » prêt sur ${config.endpoint}.`);
}
