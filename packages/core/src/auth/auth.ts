import { BRAND } from "@app/config/brand";
import { db } from "@app/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import type { OAuth2Tokens } from "better-auth/oauth2";
import { roleOf } from "../access/admin";
import { requireEnv } from "../env";
import { checkGuildMembership, fetchDiscordProfile, mapProfileToUser } from "./discord";

/** Recopie l'ID Discord du compte lié sur l'utilisateur et synchronise le miroir `role`. */
async function syncUserIdentity(userId: string): Promise<void> {
  const account = await db.account.findFirst({
    where: { userId, providerId: "discord" },
    select: { accountId: true },
  });
  if (!account) return;
  await db.user.update({
    where: { id: userId },
    data: { discordId: account.accountId, role: roleOf(account.accountId) },
  });
}

export function createAuth() {
  const baseURL = requireEnv("BETTER_AUTH_URL");

  /**
   * Remplace la récupération du profil du provider Discord pour vérifier l'appartenance
   * au serveur avant que Better Auth n'écrive quoi que ce soit en base : un non-membre
   * repart vers /refused sans compte ni session.
   */
  async function getUserInfo(tokens: OAuth2Tokens) {
    if (!tokens.accessToken) return null;
    let profile;
    let member;
    try {
      profile = await fetchDiscordProfile(tokens.accessToken);
      member = await checkGuildMembership(tokens.accessToken);
    } catch {
      // Discord injoignable : Better Auth redirige vers errorURL (/login?error=…).
      return null;
    }
    if (!member) {
      throw new APIError("FOUND", undefined, new Headers({ location: `${baseURL}/refused` }));
    }
    return {
      user: {
        ...mapProfileToUser(profile),
        email: profile.email ?? undefined,
        emailVerified: profile.verified ?? false,
      },
      data: profile,
    };
  }

  return betterAuth({
    appName: BRAND.name,
    baseURL,
    secret: requireEnv("BETTER_AUTH_SECRET"),
    database: prismaAdapter(db, { provider: "postgresql" }),
    user: {
      additionalFields: {
        // `input: false` : jamais modifiables par l'utilisateur via l'API Better Auth.
        discordId: { type: "string", required: false, input: false },
        role: { type: "string", required: false, defaultValue: "member", input: false },
      },
    },
    session: {
      additionalFields: {
        guildCheckedAt: { type: "date", required: false, input: false },
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false },
    },
    socialProviders: {
      discord: {
        clientId: requireEnv("DISCORD_CLIENT_ID"),
        clientSecret: requireEnv("DISCORD_CLIENT_SECRET"),
        // S'ajoute aux scopes par défaut `identify email`.
        scope: ["guilds"],
        getUserInfo,
        mapProfileToUser,
        overrideUserInfoOnSignIn: true,
      },
    },
    onAPIError: { errorURL: `${baseURL}/login` },
    databaseHooks: {
      session: {
        create: {
          // Une session n'est créée qu'après un contrôle d'appartenance réussi (getUserInfo).
          before: async (session) => {
            await syncUserIdentity(session.userId);
            return { data: { ...session, guildCheckedAt: new Date() } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __appAuth?: Auth };

/** Instance Better Auth partagée, créée au premier usage (l'env n'est lu qu'à ce moment). */
export function getAuth(): Auth {
  globalForAuth.__appAuth ??= createAuth();
  return globalForAuth.__appAuth;
}
