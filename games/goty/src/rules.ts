import { randomInt } from "node:crypto";

export const BASE_CATEGORIES = [
  "Coup de cœur",
  "Déception",
  "Meilleure bande-son",
  "Meilleure direction artistique",
  "Meilleur gameplay",
  "Meilleur scénario",
  "Meilleur personnage",
  "Meilleure expérience à plusieurs",
  "Meilleure ambiance / immersion",
] as const;

export type Phase = "categories" | "preparation" | "live" | "closed";
export type RoundStatus = "draft" | "announced" | "locked" | "revealing" | "done";

export function normalizeCategoryName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

export function initialRounds() {
  return [
    ...Array.from({ length: 5 }, (_, position) => ({
      name: `Top ${5 - position}`,
      rank: 5 - position,
      position,
      soundtrack: false,
    })),
    ...BASE_CATEGORIES.map((name, index) => ({
      name,
      rank: null,
      position: index + 5,
      soundtrack: name === "Meilleure bande-son",
    })),
  ].map((round) => ({ ...round, normalizedName: normalizeCategoryName(round.name) }));
}

export function votesNeeded(participantCount: number): number {
  if (!Number.isSafeInteger(participantCount) || participantCount < 1) {
    throw new RangeError("Le nombre de participants doit être un entier positif.");
  }
  return Math.ceil(participantCount * 0.75);
}

export function predictionOpen(status: RoundStatus, phase: Phase): boolean {
  return (
    (phase === "preparation" || phase === "live") && (status === "draft" || status === "announced")
  );
}

/** Copie mélangée, sans mutation de l'entrée ; tirage cryptographique côté serveur. */
export function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    // Les deux indices sont dans le tableau ; T peut lui-même être undefined.
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export function rankScores<T extends { points: number }>(
  entries: readonly T[],
): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  let rank = 0;
  return sorted.map((entry, i) => {
    if (i === 0 || sorted[i - 1]?.points !== entry.points) rank = i + 1;
    return { ...entry, rank };
  });
}

export function youtubeId(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
          ? url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
          : null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
