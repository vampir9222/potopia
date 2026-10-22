import { migrateTestDb } from "@app/db/testing";

export default function setup(): void {
  migrateTestDb();
}
