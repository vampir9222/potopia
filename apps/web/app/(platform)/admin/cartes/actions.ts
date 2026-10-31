"use server";

import {
  CardInputError,
  createCard,
  createCardImageUpload,
  importCards,
  setCardImage,
  updateCard,
  type CardImport,
  type CardInput,
} from "@app/tcg";
import type { CardEditorState } from "@app/tcg/ui";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { actionAdmin } from "@/lib/session";

/** Message lisible d'une erreur de saisie, ou null pour une erreur inattendue (relancée). */
function inputError(error: unknown): string | null {
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Formulaire invalide.";
  if (error instanceof CardInputError) return error.message;
  if (error instanceof SyntaxError) return "JSON illisible.";
  return null;
}

function readCard(formData: FormData): CardInput {
  return JSON.parse(String(formData.get("card") ?? "{}")) as CardInput;
}

/** Crée une carte, puis ouvre sa page (pour y envoyer l'illustration). */
export async function createCardAction(
  _prev: CardEditorState,
  formData: FormData,
): Promise<CardEditorState> {
  const admin = await actionAdmin();
  let id: string;
  try {
    const setId = String(formData.get("setId") ?? "");
    id = (await createCard(admin, { ...readCard(formData), setId })).id;
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
  revalidatePath("/admin/cartes");
  redirect(`/admin/cartes/${id}`);
}

/** Enregistre une carte (liée à son id par la page : `updateCardAction.bind(null, id)`). */
export async function updateCardAction(
  id: string,
  _prev: CardEditorState,
  formData: FormData,
): Promise<CardEditorState> {
  const admin = await actionAdmin();
  try {
    await updateCard(admin, z.string().min(1).parse(id), readCard(formData));
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
  revalidatePath("/admin/cartes");
  return { status: "ok", message: "Carte enregistrée." };
}

/** URL d'envoi présignée pour l'illustration d'une carte. */
export async function requestCardImageAction(
  contentType: string,
  size: number,
): Promise<{ key: string; url: string } | { error: string }> {
  const admin = await actionAdmin();
  try {
    return await createCardImageUpload(admin, { contentType, size });
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
}

/** Pose l'illustration envoyée sur la carte (liée à son id par la page). */
export async function confirmCardImageAction(
  id: string,
  key: string,
): Promise<{ error: string } | null> {
  const admin = await actionAdmin();
  try {
    await setCardImage(admin, z.string().min(1).parse(id), key);
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { error: message };
  }
  revalidatePath("/admin/cartes");
  return null;
}

export type ImportState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

/** Importe un fichier de cartes (JSON) ; les idées déjà importées sont ignorées. */
export async function importCardsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const admin = await actionAdmin();
  const file = formData.get("file");
  const text =
    file instanceof File && file.size > 0 ? await file.text() : String(formData.get("json") ?? "");
  try {
    const { created, skipped } = await importCards(admin, JSON.parse(text) as CardImport);
    revalidatePath("/admin/cartes");
    return {
      status: "ok",
      message: `${created} carte${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}, ${skipped} déjà importée${skipped > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
}
