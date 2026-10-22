"use client";

import { BRAND } from "@app/config/brand";
import { Button, Input, Label, Select } from "@app/ui";
import { useActionState, useState } from "react";

export type AdjustState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

type Props = {
  members: { id: string; name: string }[];
  /** Membre présélectionné (page d'historique d'un membre). */
  defaultUserId?: string;
  /**
   * Server action passée par l'app : elle fait requireAdmin puis adminAdjust.
   * Champs envoyés : userId, direction (credit | debit), amount, reason, idempotencyKey.
   */
  action: (state: AdjustState, formData: FormData) => Promise<AdjustState>;
};

export function AdminAdjustForm({ members, defaultUserId, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // Nouvelle clé après chaque envoi réussi : une double soumission du même envoi ne s'applique qu'une fois.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "ok") setIdempotencyKey(crypto.randomUUID());
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Label>
        Membre
        <Select name="userId" required defaultValue={defaultUserId ?? ""}>
          <option value="" disabled>
            Choisir un membre
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Label>
      <div className="flex gap-3">
        <Label>
          Opération
          <Select name="direction" defaultValue="credit">
            <option value="credit">Créditer</option>
            <option value="debit">Débiter</option>
          </Select>
        </Label>
        <Label className="flex-1">
          Montant ({BRAND.currency.symbol})
          <Input name="amount" type="number" min={1} step={1} required />
        </Label>
      </div>
      <Label>
        Motif (visible par le membre)
        <Input name="reason" required minLength={3} maxLength={200} />
      </Label>
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Valider"}
      </Button>
      {state.status !== "idle" && (
        <p
          role="status"
          className={`text-sm ${state.status === "ok" ? "text-success" : "text-danger"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
