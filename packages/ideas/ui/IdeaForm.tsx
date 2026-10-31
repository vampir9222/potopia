"use client";

import { Button, Input, Label, Select, Textarea } from "@app/ui";
import { CircleCheck, ClipboardPaste, ImagePlus, X } from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { IMAGE_TYPES, LIMITS, RARITIES, RARITY_LABELS } from "../src/validation";
import { toWebp } from "./webp";

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
  /** Illustration du message « C'est envoyé » (la mascotte de l'app) ; une coche par défaut. */
  successIcon?: ReactNode;
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

/** Première image du presse-papiers d'un événement « coller », avec un nom lisible. */
function pastedImage(event: ClipboardEvent): File | undefined {
  const item = [...event.clipboardData.items].find(
    (i) => i.kind === "file" && i.type.startsWith("image/"),
  );
  const blob = item?.getAsFile();
  if (!blob) return undefined;
  return new File([blob], blob.name && blob.name !== "image.png" ? blob.name : "image collée", {
    type: blob.type,
  });
}

export function IdeaForm({
  action,
  uploadUrlEndpoint = "/api/ideas/upload-url",
  successIcon,
}: Props) {
  const [state, formAction, submitting] = useActionState(action, { status: "idle" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lengths, setLengths] = useState({ title: 0, description: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef(0);
  const [converting, setConverting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Aperçu de l'image choisie ou collée (URL locale, libérée quand l'image change).
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /** Coller avec Ctrl+V n'importe où dans le formulaire : une image remplace celle choisie. */
  function onPaste(event: ClipboardEvent<HTMLFormElement>) {
    const image = pastedImage(event);
    if (!image) return; // du texte : collage normal dans le champ
    event.preventDefault();
    void pickFile(image);
  }

  /** Bouton « Coller une image » : lit le presse-papiers (le navigateur peut demander l'accord). */
  async function pasteFromClipboard() {
    setUploadError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          return void pickFile(new File([blob], "image collée", { type: blob.type }));
        }
      }
      setUploadError("Pas d'image dans le presse-papiers.");
    } catch {
      setUploadError("Lecture du presse-papiers impossible : utilise Ctrl+V dans le formulaire.");
    }
  }

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

  async function pickFile(picked: File | undefined) {
    const pick = ++pickRef.current;
    setUploadError(null);
    setFile(null);
    setConverting(false);
    if (!picked) return;
    if (!(picked.type in IMAGE_TYPES)) {
      setUploadError("Format d'image refusé (JPEG, PNG ou WebP).");
    } else {
      // Conversion avant le contrôle de taille : une grosse photo passe souvent sous la limite.
      setConverting(true);
      const converted = await toWebp(picked);
      // Une autre image a été choisie pendant la conversion : celle-ci est abandonnée.
      if (pick !== pickRef.current) return;
      setConverting(false);
      if (converted.size <= LIMITS.imageBytes) return setFile(converted);
      setUploadError("Image trop lourde (3 Mo maximum).");
    }
    if (fileRef.current) fileRef.current.value = "";
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

  const pending = converting || uploading || submitting;
  const error = uploadError ?? (state.status === "error" ? state.message : null);

  return (
    <form ref={formRef} onSubmit={onSubmit} onPaste={onPaste} className="flex flex-col gap-4">
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
        <span className="text-muted">
          Image (facultatif, JPEG, PNG ou WebP, convertie en WebP, 3 Mo maximum). Tu peux aussi la
          coller avec Ctrl+V.
        </span>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="border-border text-muted hover:text-text hover:bg-surface-hover flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2"
          >
            <ClipboardPaste size={16} aria-hidden />
            Coller une image
          </button>
          {file && (
            <span className="text-text flex min-w-0 items-center gap-1">
              {preview && (
                <img
                  src={preview}
                  alt=""
                  className="border-border size-10 rounded border object-cover"
                />
              )}
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
        {converting
          ? "Préparation de l'image…"
          : uploading
            ? "Envoi de l'image…"
            : submitting
              ? "Envoi…"
              : "Envoyer l'idée"}
      </Button>
      <div role="status">
        {error ? (
          <p className="text-danger text-sm">{error}</p>
        ) : state.status === "ok" && !pending ? (
          <div className="border-success/40 bg-success/10 rounded-theme flex items-start gap-3 border p-3">
            {successIcon ?? (
              <CircleCheck size={20} className="text-success mt-0.5 shrink-0" aria-hidden />
            )}
            <div className="text-sm">
              <p className="text-text font-medium">C'est envoyé, merci !</p>
              <p className="text-muted">
                Ton idée est bien arrivée chez les admins. Elle reste entre eux et toi : elle
                n'apparaîtra nulle part ailleurs. Tu peux en proposer une autre quand tu veux.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}
