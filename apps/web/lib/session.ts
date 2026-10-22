import {
  ForbiddenError,
  isAdmin,
  requireAdmin,
  requireMember,
  UnauthorizedError,
  type SessionUser,
} from "@app/core";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

/**
 * Pour les layouts et pages : membre connecté, sinon redirection (/login sans session,
 * /refused si la session vient d'être révoquée). Dédupliqué sur la requête par `cache`.
 */
export const getCurrentMember = cache(async (): Promise<SessionUser> => {
  try {
    return await requireMember(await headers());
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof ForbiddenError) redirect("/refused");
    throw error;
  }
});

/** Pour les layouts et pages admin : 403 (forbidden.tsx) si le membre n'est pas admin. */
export async function getCurrentAdmin(): Promise<SessionUser> {
  const user = await getCurrentMember();
  if (!isAdmin(user.discordId)) forbidden();
  return user;
}

/**
 * Pour les server actions : lèvent UnauthorizedError (401) ou ForbiddenError (403) au lieu de
 * rediriger. À appeler en première ligne de chaque action.
 */
export async function actionMember(): Promise<SessionUser> {
  return requireMember(await headers());
}

export async function actionAdmin(): Promise<SessionUser> {
  return requireAdmin(await headers());
}
