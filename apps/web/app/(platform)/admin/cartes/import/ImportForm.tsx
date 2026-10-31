"use client";

import { Button, Input, Label } from "@app/ui";
import { useActionState } from "react";
import { importCardsAction, type ImportState } from "../actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importCardsAction, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-col gap-4">
      <Label hint="Fichier .json au format ci-dessous.">
        Fichier de cartes
        <Input
          type="file"
          name="file"
          accept="application/json,.json"
          className="py-1.5"
          required
        />
      </Label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Import…" : "Importer"}
        </Button>
        {state.status !== "idle" && (
          <p
            role="status"
            className={state.status === "error" ? "text-danger text-sm" : "text-muted text-sm"}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
