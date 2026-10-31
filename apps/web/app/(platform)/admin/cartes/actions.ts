"use server";

import {
  CardInputError,
  createCard,
  createSet,
  listCards,
  moveCards,
  createCardImageUpload,
  importCards,
  setCardImage,
  updateCard,
  updateCards,
  type CardImport,
  type CardInput,
  type CardUpdates,
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

/**
 * Crée une carte (dans un set ou la réserve, éventuellement tirée d'une idée), puis ouvre sa page
 * pour y envoyer l'illustration. Garde-fou : si l'idée a déjà des cartes, il faut le confirmer.
 */
export async function createCardAction(
  _prev: CardEditorState,
  formData: FormData,
): Promise<CardEditorState> {
  const admin = await actionAdmin();
  let id: string;
  try {
    const setId = String(formData.get("setId") ?? "");
    const ideaId = String(formData.get("ideaId") ?? "") || null;
    if (ideaId && formData.get("confirmDuplicate") !== "on") {
      const existing = await listCards(admin, { ideaId });
      if (existing.length > 0) {
        return {
          status: "error",
          message: `Cette idée a déjà ${existing.length} carte${existing.length > 1 ? "s" : ""} : coche « Créer quand même » pour en ajouter une.`,
        };
      }
    }
    id = (await createCard(admin, { ...readCard(formData), setId, ideaId })).id;
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
  revalidatePath("/admin/cartes", "layout");
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
  revalidatePath("/admin/cartes", "layout");
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
  revalidatePath("/admin/cartes", "layout");
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
    const json = JSON.parse(text) as CardImport | CardUpdates;
    // Fichier de mise à jour : `updates` au lieu de `cards`.
    if ("updates" in json) {
      const { updated } = await updateCards(admin, json);
      revalidatePath("/admin/cartes", "layout");
      return {
        status: "ok",
        message: `${updated} carte${updated > 1 ? "s" : ""} mise${updated > 1 ? "s" : ""} à jour.`,
      };
    }
    const { created, skipped } = await importCards(admin, json);
    revalidatePath("/admin/cartes", "layout");
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

export type FormState =
  { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

/** Crée un set (code et nom), puis l'ouvre. */
export async function createSetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionAdmin();
  let code: string;
  try {
    code = (
      await createSet(admin, {
        code: String(formData.get("code") ?? "").toUpperCase(),
        name: String(formData.get("name") ?? ""),
      })
    ).code;
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
  revalidatePath("/admin/cartes", "layout");
  redirect(`/admin/cartes?set=${code}`);
}

/** Range les cartes cochées (`ids`) dans un set ou dans la réserve (`target` = « reserve »). */
export async function moveCardsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await actionAdmin();
  const target = String(formData.get("target") ?? "");
  const ids = formData.getAll("ids").map(String);
  if (ids.length === 0) return { status: "error", message: "Coche au moins une carte." };
  try {
    const { moved } = await moveCards(admin, ids, target === "reserve" ? null : target);
    revalidatePath("/admin/cartes", "layout");
    return {
      status: "ok",
      message: `${moved} carte${moved > 1 ? "s" : ""} déplacée${moved > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    const message = inputError(error);
    if (message === null) throw error;
    return { status: "error", message };
  }
}
