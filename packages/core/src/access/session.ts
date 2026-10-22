import { db } from "@app/db";
import { getAuth } from "../auth/auth";
import { checkGuildMembership, DiscordApiError } from "../auth/discord";
import { ForbiddenError, UnauthorizedError } from "../errors";
import type { User } from "../users";
import { isAdmin, roleOf } from "./admin";

export const GUILD_RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Utilisateur connecté. `role` est calculé depuis ADMIN_DISCORD_IDS, pas lu en base. */
export type SessionUser = User;

type Resolved =
  { status: "anonymous" } | { status: "revoked" } | { status: "active"; user: SessionUser };

type Membership = "member" | "not_member" | "unknown";

async function recheckMembership(userId: string): Promise<Membership> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "discord" },
    select: { id: true },
  });
  if (!account) return "not_member";
  let accessToken: string | undefined;
  try {
    // Rafraîchit le token s'il a expiré. Un refresh refusé = autorisation retirée côté Discord.
    ({ accessToken } = await getAuth().api.getAccessToken({
      body: { accountId: account.id, userId },
    }));
  } catch {
    return "not_member";
  }
  if (!accessToken) return "not_member";
  try {
    return (await checkGuildMembership(accessToken)) ? "member" : "not_member";
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 401) return "not_member";
    // Panne ou rate-limit Discord : on garde la session, nouvel essai à la prochaine requête.
    return "unknown";
  }
}

async function resolveSession(headers: Headers): Promise<Resolved> {
  const result = await getAuth().api.getSession({ headers });
  if (!result) return { status: "anonymous" };
  const { session, user } = result;

  const checkedAt = new Date(session.guildCheckedAt ?? session.createdAt).getTime();
  if (Date.now() - checkedAt > GUILD_RECHECK_INTERVAL_MS) {
    const membership = await recheckMembership(user.id);
    if (membership === "not_member") {
      // Ex-membre : toutes ses sessions sont révoquées, ses données conservées.
      await db.session.deleteMany({ where: { userId: user.id } });
      return { status: "revoked" };
    }
    if (membership === "member") {
      await db.session.update({ where: { id: session.id }, data: { guildCheckedAt: new Date() } });
    }
  }

  const discordId = user.discordId ?? null;
  return {
    status: "active",
    user: {
      id: user.id,
      discordId,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      role: roleOf(discordId),
      createdAt: new Date(user.createdAt),
    },
  };
}

/** Utilisateur connecté, ou null. Revérifie l'appartenance au serveur toutes les 6 h. */
export async function getSession(headers: Headers): Promise<SessionUser | null> {
  const resolved = await resolveSession(headers);
  return resolved.status === "active" ? resolved.user : null;
}

/** Lève UnauthorizedError (401) sans session, ForbiddenError (403) si la session vient d'être révoquée. */
export async function requireMember(headers: Headers): Promise<SessionUser> {
  const resolved = await resolveSession(headers);
  if (resolved.status === "anonymous") throw new UnauthorizedError();
  if (resolved.status === "revoked") {
    throw new ForbiddenError("Tu ne fais plus partie du serveur Discord.");
  }
  return resolved.user;
}

/** Comme requireMember, puis ForbiddenError (403) si l'utilisateur n'est pas dans ADMIN_DISCORD_IDS. */
export async function requireAdmin(headers: Headers): Promise<SessionUser> {
  const user = await requireMember(headers);
  if (!isAdmin(user.discordId)) throw new ForbiddenError("Réservé aux admins.");
  return user;
}
