import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { cookies } from "next/headers";

/**
 * Recopie dans la réponse Next les cookies posés par un appel `getAuth().api.*` fait depuis une
 * server action (session, état OAuth). Équivalent du plugin `nextCookies` de Better Auth, qui ne
 * peut pas vivre dans packages/core (pas d'import Next hors apps/).
 */
export async function applyAuthCookies(responseHeaders: Headers): Promise<void> {
  const setCookie = responseHeaders.get("set-cookie");
  if (!setCookie) return;
  const jar = await cookies();
  for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
    jar.set(name, attributes.value, toCookieOptions(attributes));
  }
}
