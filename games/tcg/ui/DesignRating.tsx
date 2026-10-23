"use client";

import { Label, Textarea } from "@app/ui";
import { Star } from "lucide-react";
import { useActionState, useRef, useState } from "react";

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

/**
 * Note de 1 à 5 étoiles et commentaire facultatif sur une proposition de design. Pas de bouton :
 * un clic sur une étoile enregistre, le commentaire s'enregistre en quittant le champ.
 */
export function DesignRating({ designId, initial, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [hover, setHover] = useState(0);
  const savedComment = useRef(initial?.comment ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const shown = hover || stars;

  function save() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
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
                onChange={() => {
                  setStars(n);
                  // Le bouton radio est déjà coché dans le DOM : le formulaire part avec la bonne note.
                  save();
                }}
                className="peer sr-only"
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
        <span className="text-muted text-sm tabular-nums" aria-live="polite">
          {pending
            ? "Enregistrement…"
            : state.status === "error"
              ? ""
              : stars
                ? state.status === "ok"
                  ? `${stars}/5 · enregistré`
                  : `${stars}/5`
                : "Clique sur une étoile pour noter"}
        </span>
      </fieldset>
      <Label hint={stars ? "Enregistré en quittant le champ." : "Note d'abord avec les étoiles."}>
        Commentaire (facultatif)
        <Textarea
          name="comment"
          maxLength={1000}
          defaultValue={initial?.comment ?? ""}
          placeholder="Ce qui te plaît, ce que tu changerais…"
          onBlur={(e) => {
            const value = e.currentTarget.value.trim();
            if (stars && value !== savedComment.current.trim()) {
              savedComment.current = value;
              save();
            }
          }}
        />
      </Label>
      {state.status === "error" && (
        <p role="status" className="text-danger text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
