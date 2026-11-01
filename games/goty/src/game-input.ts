import { z } from "zod";

export const gameInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  platform: z.string().max(100).default(""),
  period: z.string().max(100).default(""),
  completed: z.boolean().default(false),
  platinum: z.boolean().default(false),
  igdbId: z.number().int().positive().nullable().default(null),
  cover: z
    .string()
    .max(500)
    .refine((input) => {
      try {
        const url = new URL(input);
        return (
          url.protocol === "https:" &&
          url.hostname === "images.igdb.com" &&
          !url.username &&
          !url.password &&
          !url.port
        );
      } catch {
        return false;
      }
    })
    .nullable()
    .default(null),
  trailerYoutubeId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{11}$/)
    .nullable()
    .default(null),
});

export type GameInput = z.input<typeof gameInputSchema>;
export type ParsedGameInput = z.output<typeof gameInputSchema>;
