import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ForbiddenError,
  getSession,
  GUILD_RECHECK_INTERVAL_MS,
  requireAdmin,
  requireMember,
  UnauthorizedError,
} from "../src/index";
import { FakeDiscord, fakeUser, OTHER_GUILD_ID, signInWithDiscord } from "../src/testing";

const ADMIN_ID = "100000000000000001";
const MEMBER_ID = "100000000000000002";

const discord = new FakeDiscord();

beforeAll(() => discord.install());
afterAll(() => discord.uninstall());
beforeEach(async () => {
  await truncateTestDb();
  discord.users.clear();
  discord.guildsStatus = 200;
  discord.guildsCalls = 0;
});
afterEach(() => {
  process.env.ADMIN_DISCORD_IDS = ADMIN_ID;
});

async function ageSessions(userDiscordId: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { discordId: userDiscordId } });
  await db.session.updateMany({
    where: { userId: user.id },
    data: { guildCheckedAt: new Date(Date.now() - GUILD_RECHECK_INTERVAL_MS - 60_000) },
  });
}

describe("connexion Discord", () => {
  it("connecte un membre du serveur et recopie son ID Discord", async () => {
    discord.add(fakeUser(MEMBER_ID));
    const res = await signInWithDiscord(MEMBER_ID);

    expect(res.status).toBe(302);
    expect(res.location).toBe("/");
    const user = await requireMember(res.headers);
    expect(user).toMatchObject({ discordId: MEMBER_ID, role: "member", name: "joueur002" });
    expect(user.image).toMatch(/^https:\/\/cdn\.discordapp\.com\//);
  });

  it("refuse un non-membre sans créer de compte ni de session", async () => {
    discord.add(fakeUser(MEMBER_ID, { guilds: [OTHER_GUILD_ID] }));
    const res = await signInWithDiscord(MEMBER_ID);

    expect(res.status).toBe(302);
    expect(res.location).toBe("http://localhost:3000/refused");
    expect(await db.user.count()).toBe(0);
    expect(await db.account.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
    expect(await getSession(res.headers)).toBeNull();
  });

  it("stocke les tokens OAuth chiffrés", async () => {
    discord.add(fakeUser(MEMBER_ID));
    await signInWithDiscord(MEMBER_ID);
    const account = await db.account.findFirstOrThrow();
    expect(account.accountId).toBe(MEMBER_ID);
    expect(account.accessToken).toBeTruthy();
    expect(account.accessToken).not.toContain(`token-${MEMBER_ID}`);
  });

  it("synchronise le miroir role depuis ADMIN_DISCORD_IDS à la connexion", async () => {
    discord.add(fakeUser(ADMIN_ID));
    await signInWithDiscord(ADMIN_ID);
    expect((await db.user.findFirstOrThrow()).role).toBe("admin");
  });
});

describe("accès", () => {
  it("requireMember lève UnauthorizedError sans session", async () => {
    await expect(requireMember(new Headers())).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requireAdmin(new Headers())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("requireAdmin refuse un membre non admin", async () => {
    discord.add(fakeUser(MEMBER_ID));
    const { headers } = await signInWithDiscord(MEMBER_ID);
    await expect(requireAdmin(headers)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requireAdmin accepte un admin, et lit l'env à chaque appel", async () => {
    discord.add(fakeUser(ADMIN_ID));
    const { headers } = await signInWithDiscord(ADMIN_ID);
    expect((await requireAdmin(headers)).role).toBe("admin");

    process.env.ADMIN_DISCORD_IDS = "";
    await expect(requireAdmin(headers)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await requireMember(headers)).role).toBe("member");
  });
});

describe("revérification toutes les 6 h", () => {
  it("ne rappelle pas Discord avant 6 h", async () => {
    const user = discord.add(fakeUser(MEMBER_ID));
    const { headers } = await signInWithDiscord(MEMBER_ID);
    user.guilds = [];
    const calls = discord.guildsCalls;

    await requireMember(headers);
    expect(discord.guildsCalls).toBe(calls);
  });

  it("révoque la session d'un ex-membre", async () => {
    const user = discord.add(fakeUser(MEMBER_ID));
    const { headers } = await signInWithDiscord(MEMBER_ID);
    user.guilds = [OTHER_GUILD_ID];
    await ageSessions(MEMBER_ID);

    await expect(requireMember(headers)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.session.count()).toBe(0);
    // Les données de l'utilisateur sont conservées.
    expect(await db.user.count()).toBe(1);
    await expect(requireMember(headers)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("révoque la session si Discord refuse le token", async () => {
    discord.add(fakeUser(MEMBER_ID));
    const { headers } = await signInWithDiscord(MEMBER_ID);
    discord.guildsStatus = 401;
    await ageSessions(MEMBER_ID);

    await expect(requireMember(headers)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("garde la session d'un membre et repousse la prochaine vérification", async () => {
    discord.add(fakeUser(MEMBER_ID));
    const { headers } = await signInWithDiscord(MEMBER_ID);
    await ageSessions(MEMBER_ID);

    await requireMember(headers);
    const session = await db.session.findFirstOrThrow();
    expect(Date.now() - session.guildCheckedAt.getTime()).toBeLessThan(60_000);
  });

  it("garde la session si Discord est en panne, et réessaie ensuite", async () => {
    discord.add(fakeUser(MEMBER_ID));
    const { headers } = await signInWithDiscord(MEMBER_ID);
    discord.guildsStatus = 503;
    await ageSessions(MEMBER_ID);

    await requireMember(headers);
    const calls = discord.guildsCalls;
    await requireMember(headers);
    expect(discord.guildsCalls).toBe(calls + 1);
  });
});
