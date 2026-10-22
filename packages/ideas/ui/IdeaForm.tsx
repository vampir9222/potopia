"use client";

import { Button, Input, Label, Select, Textarea } from "@app/ui";
import { ImagePlus, X } from "lucide-react";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { IMAGE_TYPES, LIMITS, RARITIES, RARITY_LABELS } from "../src/validation";

export type IdeaFormState =
  { status: "idle" } | { status: "ok" } | { status: "error"; message: string };

type Props = {
  /**
   * Server action passée par l'app (requireMember puis submitIdea). Champs : title, description,
   * concernedPeople, suggestedRarity, effectIdea, imageKey.
   */
  action: (state: IdeaFormState, formData: FormData) => Promise<IdeaFormState>;
  /** Route qui renvoie `{ key, url }` pour envoyer l'image directement au stockage. */
  uploadUrlEndpoint?: string;
};

const ACCEPT = Object.keys(IMAGE_TYPES).join(",");

/** Envoie l'image au stockage via une URL présignée et renvoie sa clé. */
async function uploadImage(file: File, endpoint: string): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    key?: string;
    url?: string;
    error?: string;
  };
  if (!res.ok || !body.key || !body.url)
    throw new Error(body.error ?? "Envoi de l'image impossible.");

  const put = await fetch(body.url, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("Envoi de l'image impossible.");
  return body.key;
}

export function IdeaForm({ action, uploadUrlEndpoint = "/api/ideas/upload-url" }: Props) {
  const [state, formAction, submitting] = useActionState(action, { status: "idle" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lengths, setLengths] = useState({ title: 0, description: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Après un envoi réussi : formulaire vidé, rien n'est relisible (boîte noire).
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "ok") {
      formRef.current?.reset();
      setFile(null);
      setLengths({ title: 0, description: 0 });
    }
  }

  function pickFile(picked: File | undefined) {
    setUploadError(null);
    if (!picked) return setFile(null);
    if (!(picked.type in IMAGE_TYPES)) {
      setUploadError("Format d'image refusé (JPEG, PNG ou WebP).");
    } else if (picked.size > LIMITS.imageBytes) {
      setUploadError("Image trop lourde (5 Mo maximum).");
    } else {
      return setFile(picked);
    }
    if (fileRef.current) fileRef.current.value = "";
    setFile(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("image");
    setUploadError(null);
    if (file) {
      setUploading(true);
      try {
        formData.set("imageKey", await uploadImage(file, uploadUrlEndpoint));
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Envoi de l'image impossible.");
        return;
      } finally {
        setUploading(false);
      }
    }
    startTransition(() => formAction(formData));
  }

  const pending = uploading || submitting;
  const error = uploadError ?? (state.status === "error" ? state.message : null);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <Label hint={`${lengths.title}/${LIMITS.title}`}>
        Titre
        <Input
          name="title"
          required
          maxLength={LIMITS.title}
          onChange={(e) => setLengths((l) => ({ ...l, title: e.target.value.length }))}
        />
      </Label>
      <Label hint={`${lengths.description}/${LIMITS.description}`}>
        Description
        <Textarea
          name="description"
          required
          rows={5}
          maxLength={LIMITS.description}
          onChange={(e) => setLengths((l) => ({ ...l, description: e.target.value.length }))}
        />
      </Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          Personnes concernées (facultatif)
          <Input name="concernedPeople" maxLength={LIMITS.concernedPeople} />
        </Label>
        <Label>
          Rareté suggérée (facultatif)
          <Select name="suggestedRarity" defaultValue="">
            <option value="">—</option>
            {RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>
                {RARITY_LABELS[rarity]}
              </option>
            ))}
          </Select>
        </Label>
      </div>
      <Label>
        Idée d'effet (facultatif)
        <Textarea name="effectIdea" rows={3} maxLength={LIMITS.effectIdea} />
      </Label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Image (facultatif, JPEG, PNG ou WebP, 5 Mo maximum)</span>
        <div className="flex items-center gap-2">
          <label className="border-border text-muted hover:text-text hover:bg-surface-hover flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2">
            <ImagePlus size={16} aria-hidden />
            {file ? "Changer d'image" : "Choisir une image"}
            <input
              ref={fileRef}
              type="file"
              name="image"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>
          {file && (
            <span className="text-text flex min-w-0 items-center gap-1">
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label="Retirer l'image"
                className="text-muted hover:text-text"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X size={16} />
              </button>
            </span>
          )}
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {uploading ? "Envoi de l'image…" : submitting ? "Envoi…" : "Envoyer l'idée"}
      </Button>
      <p role="status" className="text-sm">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : state.status === "ok" && !pending ? (
          <span className="text-success">Idée envoyée, merci ! Seuls les admins la liront.</span>
        ) : null}
      </p>
    </form>
  );
}
