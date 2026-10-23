import { migrateTestDb } from "@app/db/testing";
import { configFromEnv } from "@app/storage";
import { initLocalBucket } from "@app/storage/testing";
import type { TestProject } from "vitest/node";

export default async function setup(project: TestProject): Promise<void> {
  migrateTestDb();
  // Planches d'avatar composées par le layout : bucket de test sur le stockage local.
  await initLocalBucket(
    configFromEnv({ ...process.env, ...project.config.env }),
    "http://localhost:3000",
  );
}
