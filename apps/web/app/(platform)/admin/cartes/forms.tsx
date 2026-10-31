"use client";

import { Button, Input, Label, Select } from "@app/ui";
import { type ReactNode, useActionState } from "react";
import { createSetAction, type FormState, moveCardsAction } from "./actions";

function Status({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className={state.status === "error" ? "text-danger text-sm" : "text-muted text-sm"}
    >
      {state.message}
    </p>
  );
}

/** Création d'un set (code et nom). */
export function NewSetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSetAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Label hint="Ex. S2">
        Code
        <Input name="code" required maxLength={12} className="w-28 uppercase" />
      </Label>
      <Label>
        Nom
        <Input name="name" required maxLength={60} />
      </Label>
      <Button type="submit" variant="secondary" disabled={pending}>
        Créer le set
      </Button>
      <Status state={state} />
    </form>
  );
}

/**
 * Planche de cartes à cocher, avec le déplacement de la sélection vers un set ou la réserve. Les
 * cases (`name="ids"`) sont posées par la page à côté de chaque carte.
 */
export function MoveCardsForm({
  targets,
  children,
}: {
  /** Destinations possibles : la réserve (`id` vide) et les sets, sauf celui affiché. */
  targets: { id: string; label: string }[];
  children: ReactNode;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(moveCardsAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="bg-surface border-border sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="text-muted">Cartes cochées :</span>
        <Select name="target" required defaultValue="" style={{ width: "auto" }}>
          <option value="" disabled>
            Déplacer vers…
          </option>
          {targets.map((t) => (
            <option key={t.id || "reserve"} value={t.id || "reserve"}>
              {t.label}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" disabled={pending}>
          Déplacer
        </Button>
        <span className="text-muted text-xs">
          Une carte qui quitte un set perd son numéro ; les suivantes sont renumérotées.
        </span>
        <Status state={state} />
      </div>
      {children}
    </form>
  );
}

/** Déplacement d'une seule carte (page de la carte) vers un set ou la réserve. */
export function MoveCardForm({
  cardId,
  targets,
}: {
  cardId: string;
  targets: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(moveCardsAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="ids" value={cardId} />
      <Select name="target" required defaultValue="" style={{ width: "auto" }}>
        <option value="" disabled>
          Déplacer vers…
        </option>
        {targets.map((t) => (
          <option key={t.id || "reserve"} value={t.id || "reserve"}>
            {t.label}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Déplacer
      </Button>
      <Status state={state} />
    </form>
  );
}
