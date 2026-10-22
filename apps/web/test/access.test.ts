import { ForbiddenError, notify, UnauthorizedError, countUnread } from "@app/core";
import { FakeDiscord, fakeUser, OTHER_GUILD_ID, signInWithDiscord } from "@app/core/testing";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { getBalance } from "@app/economy";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Simulation du runtime Next : en-têtes de la requête courante, redirect/forbidden qui lèvent.
const request = vi.hoisted(() => ({ headers: new Headers() }));

class Interrupt extends Error {
  constructor(
    readonly kind: "redirect" | "forbidden",
    readonly url?: string,
  ) {
    super(url ? `${kind} ${url}` : kind);
  }
}

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Interrupt("redirect", url);
  },
  forbidden: () => {
    throw new Interrupt("forbidden");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { markAllNotificationsAsRead, markNotificationAsRead } =
  await import("@/app/actions/notifications");
const { adjustBalance } = await import("@/app/(platform)/admin/economy/actions");
const { default: PlatformLayout } = await import("@/app/(platform)/layout");
const { default: DashboardPage } = await import("@/app/(platform)/page");
const { default: AdminLayout } = await import("@/app/(platform)/admin/layout");
const { default: AdminPage } = await import("@/app/(platform)/admin/page");
const { default: AdminEconomyPage } = await import("@/app/(platform)/admin/economy/page");

const ADMIN_ID = "100000000000000001";
const MEMBER_ID = "100000000000000002";
const discord = new FakeDiscord();

function adjustForm(userId: string, amount = 100): FormData {
  const form = new FormData();
  form.set("userId", userId);
  form.set("direction", "credit");
  form.set("amount", String(amount));
  form.set("reason", "Tournoi");
  form.set("idempotencyKey", crypto.randomUUID());
  return form;
}

/** Server actions, chacune appelée avec des arguments valides. */
const actions: Record<string, () => Promise<unknown>> = {
  markNotificationAsRead: () => markNotificationAsRead("inconnue"),
  markAllNotificationsAsRead: () => markAllNotificationsAsRead(),
  adjustBalance: () => adjustBalance({ status: "idle" }, adjustForm("inconnu")),
};

/** Pages et layouts protégés. */
const children = null;
const memberPages: Record<string, () => Promise<unknown>> = {
  "(platform)/layout": () => PlatformLayout({ children }),
  "(platform)/page": () => DashboardPage(),
};
const adminPages: Record<string, () => Promise<unknown>> = {
  "admin/layout": () => AdminLayout({ children }),
  "admin/page": () => AdminPage(),
  "admin/economy/page": () => AdminEconomyPage({ searchParams: Promise.resolve({}) }),
};

async function signIn(discordId: string): Promise<string> {
  discord.add(fakeUser(discordId));
  request.headers = (await signInWithDiscord(discordId)).headers;
  const user = await db.user.findUniqueOrThrow({ where: { discordId } });
  return user.id;
}

/** Connecte un membre puis le fait quitter le serveur : la prochaine requête révoque sa session. */
async function signInAsExMember(): Promise<void> {
  await signIn(MEMBER_ID);
  const user = discord.users.get(MEMBER_ID);
  if (user) user.guilds = [OTHER_GUILD_ID];
  await db.session.updateMany({ data: { guildCheckedAt: new Date(0) } });
}

beforeAll(() => discord.install());
afterAll(() => discord.uninstall());
beforeEach(async () => {
  await truncateTestDb();
  discord.users.clear();
  request.headers = new Headers();
});

describe("server actions", () => {
  for (const [name, call] of Object.entries(actions)) {
    it(`${name} refuse une requête sans session (401)`, async () => {
      await expect(call()).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it(`${name} refuse une session non membre (403)`, async () => {
      await signInAsExMember();
      await expect(call()).rejects.toBeInstanceOf(ForbiddenError);
    });
  }

  it("adjustBalance refuse un membre non admin (403) sans toucher au solde", async () => {
    const memberId = await signIn(MEMBER_ID);
    await expect(adjustBalance({ status: "idle" }, adjustForm(memberId))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await getBalance(memberId)).toBe(0);
  });

  it("adjustBalance crédite un membre quand l'admin est connecté", async () => {
    const memberId = await signIn(MEMBER_ID);
    await signIn(ADMIN_ID);
    const state = await adjustBalance({ status: "idle" }, adjustForm(memberId, 250));

    expect(state.status).toBe("ok");
    expect(await getBalance(memberId)).toBe(250);
    expect(await countUnread(memberId)).toBe(1);
  });

  it("adjustBalance renvoie une erreur lisible pour un débit trop élevé", async () => {
    const memberId = await signIn(MEMBER_ID);
    await signIn(ADMIN_ID);
    const form = adjustForm(memberId, 10);
    form.set("direction", "debit");
    const state = await adjustBalance({ status: "idle" }, form);
    expect(state).toMatchObject({ status: "error" });
    expect(state.status === "error" && state.message).toMatch(/Solde insuffisant/);
  });

  it("markNotificationAsRead ne lit pas la notification d'un autre membre", async () => {
    const adminId = await signIn(ADMIN_ID);
    const notification = await notify({ userId: adminId, title: "Privée" });
    await signIn(MEMBER_ID);

    await markNotificationAsRead(notification.id);
    expect(await countUnread(adminId)).toBe(1);
  });
});

describe("pages et layouts", () => {
  for (const [name, render] of Object.entries({ ...memberPages, ...adminPages })) {
    it(`${name} renvoie vers /login sans session`, async () => {
      await expect(render()).rejects.toMatchObject({ kind: "redirect", url: "/login" });
    });

    it(`${name} renvoie vers /refused pour une session non membre`, async () => {
      await signInAsExMember();
      await expect(render()).rejects.toMatchObject({ kind: "redirect", url: "/refused" });
    });
  }

  for (const [name, render] of Object.entries(adminPages)) {
    it(`${name} refuse un membre non admin (403)`, async () => {
      await signIn(MEMBER_ID);
      await expect(render()).rejects.toMatchObject({ kind: "forbidden" });
    });

    it(`${name} s'affiche pour un admin`, async () => {
      await signIn(ADMIN_ID);
      await expect(render()).resolves.toBeTruthy();
    });
  }

  it("le dashboard s'affiche pour un membre", async () => {
    await signIn(MEMBER_ID);
    for (const render of Object.values(memberPages)) await expect(render()).resolves.toBeTruthy();
  });
});
