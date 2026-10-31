import { z } from "zod";
import { GotyError } from "./errors";
import { id } from "./validation";

const previousMode = z.enum(["waiting", "round", "recap"]);
const screenSchema = z.object({
  mode: z.enum(["waiting", "round", "recap", "leaderboard"]),
  roundId: id.nullable().default(null),
  audio: z
    .object({ userId: id, nonce: z.string().min(1).max(100) })
    .nullable()
    .default(null),
  previousMode: previousMode.optional(),
});

export type CeremonyScreen = z.output<typeof screenSchema>;

/** Projection explicite du JSON stocké ; aucune propriété supplémentaire n'est transmise. */
export function readScreen(input: unknown): CeremonyScreen {
  const parsed = screenSchema.safeParse(input);
  if (!parsed.success) throw new GotyError("CONFLICT", "État de présentation invalide.", 409);
  return parsed.data;
}
