"use server";

import { InvalidImageError, submitIdea } from "@app/ideas";
import type { IdeaFormState } from "@app/ideas/ui";
import { ZodError } from "zod";
import { actionMember } from "@/lib/session";

export async function sendIdea(_prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const user = await actionMember();
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };

  try {
    await submitIdea(user.id, {
      title: field("title") ?? "",
      description: field("description") ?? "",
      concernedPeople: field("concernedPeople"),
      suggestedRarity: field("suggestedRarity"),
      effectIdea: field("effectIdea"),
      imageKey: field("imageKey"),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return { status: "error", message: error.issues[0]?.message ?? "Formulaire invalide." };
    }
    if (error instanceof InvalidImageError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  return { status: "ok" };
}
