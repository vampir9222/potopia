import { resetTestDb } from "../src/testing";
import { loadRootEnv } from "./env";

loadRootEnv();
await resetTestDb();
console.log("Base de test migrée et vidée.");
