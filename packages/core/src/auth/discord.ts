import type { DiscordProfile } from "better-auth/social-providers";
import { z } from "zod";
import { requireEnv } from "../env";

const DISCORD_API = "https://discord.com/api/v10";
// Maximum autorisé par l'endpoint /users/@me/guilds.
const GUILDS_PAGE_SIZE = 200;

/** Réponse non-2xx de l'API Discord. `status` permet de distinguer token invalide (401) et panne. */
export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    endpoint: string,
  ) {
    super(`API Discord : ${endpoint} a répondu ${status}.`);
    this.name = "DiscordApiError";
  }
}

async function discordGet(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new DiscordApiError(res.status, path.split("?")[0] ?? path);
  return res.json();
}

const guildsSchema = z.array(z.object({ id: z.string() }));

/**
 * Vrai si l'utilisateur du token est membre du serveur DISCORD_GUILD_ID (scope `guilds`).
 * Lève DiscordApiError si Discord refuse le token ou ne répond pas correctement.
 */
export async function checkGuildMembership(
  accessToken: string,
  guildId = requireEnv("DISCORD_GUILD_ID"),
): Promise<boolean> {
  let after: string | undefined;
  for (;;) {
    const query = `?limit=${GUILDS_PAGE_SIZE}${after ? `&after=${after}` : ""}`;
    const guilds = guildsSchema.parse(await discordGet(`/users/@me/guilds${query}`, accessToken));
    if (guilds.some((g) => g.id === guildId)) return true;
    const last = guilds.at(-1);
    if (guilds.length < GUILDS_PAGE_SIZE || !last) return false;
    after = last.id;
  }
}

const profileSchema = z.looseObject({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullish(),
  avatar: z.string().nullish(),
  email: z.string().nullish(),
  verified: z.boolean().optional(),
});

export async function fetchDiscordProfile(accessToken: string): Promise<DiscordProfile> {
  return profileSchema.parse(await discordGet("/users/@me", accessToken)) as DiscordProfile;
}

export function avatarUrl(profile: Pick<DiscordProfile, "id" | "avatar">): string {
  if (!profile.avatar) {
    // Avatar par défaut des comptes au nouveau système de pseudos.
    const index = Number((BigInt(profile.id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${ext}`;
}

/**
 * Pseudo et avatar depuis le profil Discord, réappliqués à chaque connexion.
 * L'ID Discord n'en fait pas partie : Better Auth ignore les champs non modifiables par
 * l'utilisateur venant du provider, il est recopié depuis le compte lié (voir syncUserIdentity).
 */
export function mapProfileToUser(profile: DiscordProfile): { name: string; image: string } {
  return { name: profile.global_name || profile.username, image: avatarUrl(profile) };
}
