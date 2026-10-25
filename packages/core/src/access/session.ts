import { db } from "@app/db";
import { getAuth } from "../auth/auth";
import { checkGuildMembership, DiscordApiError } from "../auth/discord";
import { ForbiddenError, UnauthorizedError } from "../errors";
import type { User } from "../users";
import { isAdmin, roleOf } from "./admin";

export const GUILD_RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Après une vérification sans réponse (panne Discord), prochain essai dans ce délai, pas à chaque requête. */
export const GUILD_RETRY_MS = 15 * 60 * 1000;
/** Sans réponse de Discord pendant tout ce délai, la session est révoquée malgré tout. */
export const GUILD_GRACE_MS = 24 * 60 * 60 * 1000;

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
    // Rafraîchit le token s'il a expiré.
    ({ accessToken } = await getAuth().api.getAccessToken({
      body: { accountId: account.id, userId },
    }));
  } catch {
    // Better Auth renvoie la même erreur pour un refresh refusé (autorisation retirée) et pour
    // une panne du endpoint token de Discord : on ne révoque pas sur-le-champ, le délai de grâce
    // (GUILD_GRACE_MS) finit le travail si c'était un vrai refus.
    return "unknown";
  }
  if (!accessToken) return "unknown";
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

  const now = Date.now();
  const checkedAt = new Date(session.guildCheckedAt ?? session.createdAt).getTime();
  if (now - checkedAt > GUILD_RECHECK_INTERVAL_MS) {
    const membership = await recheckMembership(user.id);
    const unknownSince = session.guildUnknownSince
      ? new Date(session.guildUnknownSince).getTime()
      : now;
    if (membership === "not_member" || now - unknownSince > GUILD_GRACE_MS) {
      // Ex-membre (ou Discord muet depuis trop longtemps) : toutes ses sessions sont révoquées,
      // ses données conservées.
      await db.session.deleteMany({ where: { userId: user.id } });
      return { status: "revoked" };
    }
    if (membership === "member") {
      await db.session.update({
        where: { id: session.id },
        data: { guildCheckedAt: new Date(now), guildUnknownSince: null },
      });
    } else {
      // Panne ou rate-limit Discord : on garde la session et on réessaie dans GUILD_RETRY_MS
      // (pas à chaque requête, pour ne pas entretenir un rate-limit).
      await db.session.update({
        where: { id: session.id },
        data: {
          guildCheckedAt: new Date(now - GUILD_RECHECK_INTERVAL_MS + GUILD_RETRY_MS),
          guildUnknownSince: new Date(unknownSince),
        },
      });
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
