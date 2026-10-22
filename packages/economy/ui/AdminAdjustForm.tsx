"use client";

import { BRAND } from "@app/config/brand";
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

const field =
  "border-border bg-bg text-text w-full rounded-md border px-3 py-2 text-sm focus:border-accent focus:outline-none";

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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Membre</span>
        <select name="userId" required defaultValue={defaultUserId ?? ""} className={field}>
          <option value="" disabled>
            Choisir un membre
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Opération</span>
          <select name="direction" defaultValue="credit" className={field}>
            <option value="credit">Créditer</option>
            <option value="debit">Débiter</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted">Montant ({BRAND.currency.symbol})</span>
          <input name="amount" type="number" min={1} step={1} required className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Motif (visible par le membre)</span>
        <input name="reason" required minLength={3} maxLength={200} className={field} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-bg rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Valider"}
      </button>
      {state.status !== "idle" && (
        <p
          role="status"
          className={`text-sm ${state.status === "ok" ? "text-accent" : "text-red-400"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
