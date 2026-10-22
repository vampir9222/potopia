"use server";

import { getAuth } from "@app/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { applyAuthCookies } from "@/lib/auth-cookies";

// Connexion et déconnexion sont les deux seules actions sans requireMember : elles
// ouvrent et ferment la session, comme les routes /api/auth de Better Auth.

export async function signInWithDiscord(): Promise<void> {
  const { headers: responseHeaders, response } = await getAuth().api.signInSocial({
    body: { provider: "discord", callbackURL: "/", errorCallbackURL: "/login" },
    headers: await headers(),
    returnHeaders: true,
  });
  // Cookie d'état OAuth, vérifié au retour de Discord.
  await applyAuthCookies(responseHeaders);
  if (!response.url) throw new Error("Better Auth n'a pas renvoyé d'URL Discord.");
  redirect(response.url);
}

export async function signOut(): Promise<void> {
  const { headers: responseHeaders } = await getAuth().api.signOut({
    headers: await headers(),
    returnHeaders: true,
  });
  await applyAuthCookies(responseHeaders);
  redirect("/login");
}
