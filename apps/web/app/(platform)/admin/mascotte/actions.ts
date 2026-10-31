"use server";

import { putObject } from "@app/storage";
import { redirect } from "next/navigation";
import {
  MASCOT_MAX_BYTES,
  MASCOT_PHRASES_KEY,
  MASCOT_TYPES,
  mascotKey,
  mascotPartSchema,
  mascotPhrasesSchema,
} from "@/lib/mascot";
import { actionAdmin } from "@/lib/session";

/** Le type annoncé par le navigateur ne suffit pas : on vérifie la signature du fichier. */
function isImage(bytes: Uint8Array, type: string): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (type === "image/png") return bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

/**
 * Remplace les images de la mascotte (corps, couronne, ou les deux) dans le stockage privé.
 * Un champ laissé vide garde l'image actuelle.
 */
export async function uploadMascotAction(formData: FormData): Promise<void> {
  await actionAdmin();
  const uploads = [];
  for (const part of mascotPartSchema.options) {
    const file = formData.get(part);
    if (!(file instanceof File) || file.size === 0) continue;
    const type = MASCOT_TYPES.find((t) => t === file.type);
    const body = new Uint8Array(await file.arrayBuffer());
    if (!type || file.size > MASCOT_MAX_BYTES || !isImage(body, type)) {
      redirect("/admin/mascotte?erreur=1");
    }
    uploads.push({ key: mascotKey(part), body, contentType: type });
  }
  for (const upload of uploads) await putObject(upload);
  redirect(uploads.length > 0 ? "/admin/mascotte?ok=1" : "/admin/mascotte");
}

/** Remplace les phrases de la mascotte (une par ligne, lignes vides ignorées). */
export async function saveMascotPhrasesAction(formData: FormData): Promise<void> {
  await actionAdmin();
  const lines = String(formData.get("phrases") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const phrases = mascotPhrasesSchema.safeParse(lines);
  if (!phrases.success) redirect("/admin/mascotte?erreur=phrases");
  await putObject({
    key: MASCOT_PHRASES_KEY,
    body: new TextEncoder().encode(JSON.stringify(phrases.data)),
    contentType: "application/json",
  });
  redirect("/admin/mascotte?ok=phrases");
}
