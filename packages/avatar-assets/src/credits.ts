import creditsJson from "../data/credits.json";
import type { Credit } from "./types";

/** Auteurs, licences et liens de chaque élément importé (page /credits). */
export const credits = creditsJson as unknown as Credit[];
