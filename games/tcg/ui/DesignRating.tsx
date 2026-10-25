"use client";

import { Label, Textarea } from "@app/ui";
import { Star } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

export type RateState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

type Props = {
  designId: string;
  /** Note déjà donnée par le membre connecté, s'il y en a une (0 = commentaire sans note). */
  initial: { stars: number; comment: string | null } | null;
  /**
   * Server action passée par l'app : elle vérifie le membre connecté puis appelle rateDesign.
   * Champs envoyés : designId, stars (0 à 5, 0 = sans note), comment.
   */
  action: (state: RateState, formData: FormData) => Promise<RateState>;
};

/**
 * Note de 0 à 5 étoiles et commentaire facultatif sur une proposition de design. Pas de bouton :
 * un clic sur une étoile enregistre (un second clic sur la même retire la note), le commentaire
 * s'enregistre en quittant le champ.
 *
 * L'envoi part de l'état React et non d'un <form> : React réinitialise un formulaire après chaque
 * action, ce qui effaçait le commentaire et décochait les étoiles.
 */
export function DesignRating({ designId, initial, action }: Props) {
  const [state, dispatch, pending] = useActionState(action, { status: "idle" });
  const [, startTransition] = useTransition();
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [hover, setHover] = useState(0);
  // Dernière valeur enregistrée côté serveur, et celle en cours d'envoi : `saved` n'avance qu'au
  // retour « ok », sinon une erreur empêcherait de renvoyer la même note.
  const saved = useRef({ stars: initial?.stars ?? 0, comment: (initial?.comment ?? "").trim() });
  const sent = useRef(saved.current);
  const shown = hover || stars;

  useEffect(() => {
    if (state.status === "ok") saved.current = sent.current;
    // Erreur : les étoiles reviennent à la dernière note enregistrée (le commentaire tapé reste).
    if (state.status === "error") setStars(saved.current.stars);
  }, [state]);

  function save(next: { stars: number; comment: string }) {
    const trimmed = next.comment.trim();
    if (next.stars === saved.current.stars && trimmed === saved.current.comment) return;
    sent.current = { stars: next.stars, comment: trimmed };
    const data = new FormData();
    data.set("designId", designId);
    data.set("stars", String(next.stars));
    data.set("comment", trimmed);
    startTransition(() => dispatch(data));
  }

  function pick(n: number) {
    const next = stars === n ? 0 : n;
    setStars(next);
    save({ stars: next, comment });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className="flex"
          role="radiogroup"
          aria-label="Note sur 5"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} étoile${n > 1 ? "s" : ""}${stars === n ? " (cliquer pour retirer)" : ""}`}
              title={stars === n ? "Retirer la note" : `${n} étoile${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => pick(n)}
              className="focus-visible:outline-accent cursor-pointer rounded-sm p-0.5 focus-visible:outline-2"
            >
              <Star
                size={28}
                aria-hidden
                className={`transition-colors ${n <= shown ? "fill-accent text-accent" : "text-muted"}`}
              />
            </button>
          ))}
        </div>
        <span className="text-muted min-w-44 text-sm tabular-nums" aria-live="polite">
          {pending
            ? "Enregistrement…"
            : state.status === "error"
              ? ""
              : `${stars ? `${stars}/5` : "Pas de note"}${state.status === "ok" ? " · enregistré" : ""}`}
        </span>
      </div>
      <Label hint="Enregistré en quittant le champ, avec ou sans note.">
        Commentaire (facultatif)
        <Textarea
          name="comment"
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => save({ stars, comment })}
          placeholder="Ce qui te plaît, ce que tu changerais…"
        />
      </Label>
      {state.status === "error" && (
        <p role="status" className="text-danger text-sm">
          {state.message}
        </p>
      )}
    </div>
  );
}
