import { migrateTestDb } from "../src/testing";

export default function setup(): void {
  migrateTestDb();
}
