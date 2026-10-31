"use client";

import { Button, Input, Label, Select } from "@app/ui";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useActionState, useEffect, useRef, useState, useTransition } from "react";
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

/** Délai après la dernière frappe avant de chercher. */
const SEARCH_DELAY = 300;

/**
 * Recherche de cartes qui se met à jour pendant la frappe (Entrée : tout de suite). Elle change
 * seulement `?q=` de l'adresse : le serveur renvoie les cartes trouvées, sans recharger la page.
 * Le champ n'a pas de `name` : il vit dans le formulaire des cases à cocher sans s'y envoyer.
 */
export function CardSearch({ query, set }: { query: string; set: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sent = useRef(query);

  function search(q: string) {
    clearTimeout(timer.current);
    const trimmed = q.trim();
    if (trimmed === sent.current) return;
    sent.current = trimmed;
    const params = new URLSearchParams({ set });
    if (trimmed) params.set("q", trimmed);
    startTransition(() => router.replace(`/admin/cartes?${params}`, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div role="search" className="relative w-full max-w-sm">
      <Search
        size={16}
        aria-hidden
        className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(next), SEARCH_DELAY);
        }}
        onKeyDown={(e) => {
          // Entrée cherche tout de suite, sans envoyer le formulaire des cases à cocher.
          if (e.key === "Enter") {
            e.preventDefault();
            search(value);
          }
          if (e.key === "Escape") {
            setValue("");
            search("");
          }
        }}
        placeholder="Chercher une carte : nom, famille, effet…"
        aria-label="Chercher une carte"
        aria-busy={pending}
        maxLength={60}
        className="pr-9 pl-9"
      />
      {pending ? (
        <span
          aria-hidden
          className="border-muted absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-t-transparent"
        />
      ) : (
        value && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => {
              setValue("");
              search("");
            }}
            className="text-muted hover:text-text absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            <X size={14} aria-hidden />
          </button>
        )
      )}
    </div>
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
