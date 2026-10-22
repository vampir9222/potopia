import type { TestProject } from "vitest/node";
import { initLocalBucket } from "../scripts/init";
import { configFromEnv } from "../src/client";

export default async function setup(project: TestProject): Promise<void> {
  const env = { ...process.env, ...project.config.env };
  await initLocalBucket(configFromEnv(env), "http://localhost:3000");
}
