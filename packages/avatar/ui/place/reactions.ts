/**
 * Réactions de la place à l'activité : type d'événement (`app/type`) → réaction de l'auteur.
 * Pour réagir à un nouvel événement, ajouter une entrée ici. Les payloads ne contiennent jamais de
 * contenu privé (voir publishEvent), seulement des compteurs.
 */

export type PlaceEvent = {
  id: string;
  userId: string;
  app: string;
  type: string;
  payload: unknown;
};

export type Reaction =
  { kind: "jump" } | { kind: "emote" } | { kind: "confetti" } | { kind: "bubble"; text: string };

type ReactionRule = (event: PlaceEvent) => Reaction | Reaction[] | null;

function numberField(payload: unknown, key: string): number | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

export const REACTIONS: Record<string, ReactionRule> = {
  "avatar/updated": () => [{ kind: "emote" }, { kind: "bubble", text: "Nouveau look !" }],
  "ideas/idea_submitted": () => [{ kind: "jump" }, { kind: "bubble", text: "💡" }],
  "trois/day_completed": (event) =>
    numberField(event.payload, "found") === 3
      ? [{ kind: "confetti" }, { kind: "jump" }, { kind: "bubble", text: "3 sur 3 !" }]
      : { kind: "jump" },
};

/** Réactions à un événement (un saut par défaut : tout signe d'activité anime la place). */
export function reactionsFor(event: PlaceEvent): Reaction[] {
  const rule = REACTIONS[`${event.app}/${event.type}`];
  const result = rule ? rule(event) : { kind: "jump" as const };
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

/** Petites phrases au clic. */
export const CLICK_LINES = ["Salut !", "Hé !", "Ça va ?", "♪", "Hop !", "Coucou !", "Yo !"];
