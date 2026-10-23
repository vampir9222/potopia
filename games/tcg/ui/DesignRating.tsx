"use client";

import { Button, Label, Textarea } from "@app/ui";
import { Star } from "lucide-react";
import { useActionState, useState } from "react";

export type RateState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

type Props = {
  designId: string;
  /** Note déjà donnée par l'admin connecté, s'il y en a une. */
  initial: { stars: number; comment: string | null } | null;
  /**
   * Server action passée par l'app : elle fait requireAdmin puis rateDesign.
   * Champs envoyés : designId, stars (1 à 5), comment.
   */
  action: (state: RateState, formData: FormData) => Promise<RateState>;
};

/** Note de 1 à 5 étoiles et commentaire facultatif sur une proposition de design. */
export function DesignRating({ designId, initial, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || stars;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="designId" value={designId} />
      <fieldset className="flex items-center gap-3">
        <legend className="sr-only">Note sur 5</legend>
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer p-0.5"
              onMouseEnter={() => setHover(n)}
              title={`${n} étoile${n > 1 ? "s" : ""}`}
            >
              <input
                type="radio"
                name="stars"
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
                className="peer sr-only"
                required
              />
              <Star
                size={28}
                aria-hidden
                className={`peer-focus-visible:outline-accent rounded-sm transition-colors peer-focus-visible:outline-2 ${
                  n <= shown ? "fill-accent text-accent" : "text-muted"
                }`}
              />
              <span className="sr-only">
                {n} étoile{n > 1 ? "s" : ""}
              </span>
            </label>
          ))}
        </div>
        <span className="text-muted text-sm tabular-nums">
          {stars ? `${stars}/5` : "Pas encore noté"}
        </span>
      </fieldset>
      <Label>
        Commentaire (facultatif)
        <Textarea
          name="comment"
          maxLength={1000}
          defaultValue={initial?.comment ?? ""}
          placeholder="Ce qui te plaît, ce que tu changerais…"
        />
      </Label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || stars === 0}>
          {pending ? "Envoi…" : initial ? "Mettre à jour" : "Enregistrer"}
        </Button>
        {state.status !== "idle" && (
          <p
            role="status"
            className={`text-sm ${state.status === "ok" ? "text-success" : "text-danger"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
