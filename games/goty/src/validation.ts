import { z } from "zod";
import { GotyError } from "./errors";

export const id = z.string().trim().min(1).max(200);

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new GotyError("INVALID_INPUT", "Données GOTY invalides.", 400);
  return result.data;
}

export const editionInput = z.object({
  actorId: id,
  year: z.number().int().min(2000).max(2200),
  name: z.string().trim().min(1).max(100),
});

export const accessInput = z.object({ actorId: id, editionId: id });
export const membersInput = accessInput.extend({
  expectedVersion: z.number().int().positive(),
  members: z
    .array(z.object({ userId: id, organizer: z.boolean(), presenter: z.boolean() }))
    .min(1)
    .refine((members) => new Set(members.map((member) => member.userId)).size === members.length),
});
