"use client";

import { Button, Card, Input, Label } from "@app/ui";
import { CircleCheck, Save } from "lucide-react";
import { useActionState, useState } from "react";

export type PhraseSaveState =
  { status: "idle" } | { status: "ok" } | { status: "error"; message: string };

type Props = {
  initialPhrase: string | null;
  maxLength: number;
  /** Server action : champ envoyé `phrase` (vide : la retire), revalidé par le serveur. */
  action: (state: PhraseSaveState, formData: FormData) => Promise<PhraseSaveState>;
};

/** Phrase du membre, que son personnage dit sur la place. */
export function PhraseForm({ initialPhrase, maxLength, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [value, setValue] = useState(initialPhrase ?? "");

  return (
    <Card title="Ma phrase">
      <form action={formAction} className="flex flex-col gap-3">
        <Label
          hint={`${value.length}/${maxLength} · ton personnage la dit de temps en temps sur la place, et quand on clique dessus. Vide : aucune phrase.`}
        >
          Phrase
          <Input
            name="phrase"
            value={value}
            maxLength={maxLength}
            placeholder="Salut la compagnie !"
            onChange={(e) => setValue(e.target.value)}
          />
        </Label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            <Save size={16} aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <p role="status" className="text-sm">
            {state.status === "ok" && (
              <span className="text-success inline-flex items-center gap-1.5">
                <CircleCheck size={16} aria-hidden /> Phrase enregistrée.
              </span>
            )}
            {state.status === "error" && <span className="text-danger">{state.message}</span>}
          </p>
        </div>
      </form>
    </Card>
  );
}
