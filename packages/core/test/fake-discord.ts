import { getAuth } from "../src/auth/auth";

export const GUILD_ID = "123456789012345678";
export const OTHER_GUILD_ID = "876543210987654321";
const BASE_URL = "http://localhost:3000";

export type FakeDiscordUser = {
  id: string;
  username: string;
  email: string;
  guilds: string[];
};

/** Membre fictif du serveur. `id` doit être unique dans un test. */
export function fakeUser(id: string, overrides: Partial<FakeDiscordUser> = {}): FakeDiscordUser {
  return {
    id,
    username: `joueur${id.slice(-3)}`,
    email: `${id}@example.test`,
    guilds: [GUILD_ID],
    ...overrides,
  };
}

/**
 * Simule l'API Discord (token, profil, serveurs) en remplaçant `fetch`. Le code OAuth
 * transmis au callback est l'ID Discord de l'utilisateur, le token en dérive.
 */
export class FakeDiscord {
  readonly users = new Map<string, FakeDiscordUser>();
  /** Statut forcé pour /users/@me/guilds (panne Discord, token révoqué…). */
  guildsStatus = 200;
  guildsCalls = 0;
  private readonly realFetch = globalThis.fetch;

  install(): void {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.hostname !== "discord.com") return this.realFetch(input, init);
      return this.handle(url, init);
    }) as typeof fetch;
  }

  uninstall(): void {
    globalThis.fetch = this.realFetch;
  }

  add(user: FakeDiscordUser): FakeDiscordUser {
    this.users.set(user.id, user);
    return user;
  }

  private userFromAuth(init?: RequestInit): FakeDiscordUser | undefined {
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    return this.users.get(auth.replace(/^Bearer token-/, ""));
  }

  private async handle(url: URL, init?: RequestInit): Promise<Response> {
    if (url.pathname === "/api/oauth2/token") {
      const body = new URLSearchParams(String(init?.body ?? ""));
      const code = body.get("code") ?? body.get("refresh_token")?.replace(/^refresh-/, "");
      if (!code || !this.users.has(code))
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({
        access_token: `token-${code}`,
        refresh_token: `refresh-${code}`,
        token_type: "Bearer",
        expires_in: 604800,
        scope: "identify email guilds",
      });
    }
    const user = this.userFromAuth(init);
    if (!user) return Response.json({ message: "401: Unauthorized" }, { status: 401 });
    if (url.pathname.endsWith("/users/@me")) {
      return Response.json({
        id: user.id,
        username: user.username,
        global_name: null,
        avatar: null,
        discriminator: "0",
        email: user.email,
        verified: true,
      });
    }
    if (url.pathname.endsWith("/users/@me/guilds")) {
      this.guildsCalls++;
      if (this.guildsStatus !== 200) return Response.json({}, { status: this.guildsStatus });
      return Response.json(user.guilds.map((id) => ({ id, name: "Serveur fictif" })));
    }
    return Response.json({ message: "404: Not Found" }, { status: 404 });
  }
}

function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/**
 * Déroule le vrai flux OAuth de Better Auth : sign-in/social puis callback Discord.
 * Renvoie la réponse du callback et les cookies à renvoyer pour être connecté.
 */
export async function signInWithDiscord(
  discordId: string,
): Promise<{ status: number; location: string | null; headers: Headers }> {
  const auth = getAuth();
  const start = await auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ provider: "discord", callbackURL: "/" }),
    }),
  );
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state") ?? "";

  const callback = await auth.handler(
    new Request(`${BASE_URL}/api/auth/callback/discord?code=${discordId}&state=${state}`, {
      headers: { cookie: cookieHeader(start) },
    }),
  );
  return {
    status: callback.status,
    location: callback.headers.get("location"),
    headers: new Headers({ cookie: cookieHeader(callback) }),
  };
}
