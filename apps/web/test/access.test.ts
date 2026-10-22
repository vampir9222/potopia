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
    readonly kind: "redirect" | "forbidden" | "notFound",
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
  notFound: () => {
    throw new Interrupt("notFound");
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
const { sendIdea } = await import("@/app/(platform)/ideas/actions");
const { default: IdeasPage } = await import("@/app/(platform)/ideas/page");
const { default: AdminIdeasPage } = await import("@/app/(platform)/admin/ideas/page");
const { default: AdminIdeaPage } = await import("@/app/(platform)/admin/ideas/[id]/page");
const uploadUrlRoute = await import("@/app/api/ideas/upload-url/route");
const ideaImageRoute = await import("@/app/api/admin/ideas/[id]/image/route");

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
  sendIdea: () => sendIdea({ status: "idle" }, ideaForm()),
};

function ideaForm(): FormData {
  const form = new FormData();
  form.set("title", "Une idée");
  form.set("description", "Une description");
  return form;
}

/** Idée existante (créée avant chaque test) pour les pages et routes de détail. */
let ideaId = "";

/** Route handlers, appelés avec les cookies de la requête courante. */
const requestUploadUrl = () =>
  uploadUrlRoute.POST(
    new Request("http://localhost:3000/api/ideas/upload-url", {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "content-type": "application/json",
      },
      body: JSON.stringify({ contentType: "image/png", size: 100 }),
    }),
  );
const requestIdeaImage = () =>
  ideaImageRoute.GET(
    new Request(`http://localhost:3000/api/admin/ideas/${ideaId}/image`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    }),
    { params: Promise.resolve({ id: ideaId }) },
  );
const routes: Record<string, () => Promise<Response>> = {
  "POST /api/ideas/upload-url": requestUploadUrl,
  "GET /api/admin/ideas/[id]/image": requestIdeaImage,
};

/** Pages et layouts protégés. */
const children = null;
const memberPages: Record<string, () => Promise<unknown>> = {
  "(platform)/layout": () => PlatformLayout({ children }),
  "(platform)/page": () => DashboardPage(),
  "ideas/page": () => IdeasPage(),
};
const adminPages: Record<string, () => Promise<unknown>> = {
  "admin/layout": () => AdminLayout({ children }),
  "admin/page": () => AdminPage(),
  "admin/economy/page": () => AdminEconomyPage({ searchParams: Promise.resolve({}) }),
  "admin/ideas/page": () => AdminIdeasPage({ searchParams: Promise.resolve({}) }),
  "admin/ideas/[id]/page": () => AdminIdeaPage({ params: Promise.resolve({ id: ideaId }) }),
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
  ideaId = (
    await db.idea.create({
      data: { authorId: "auteur-fictif", title: "Titre", description: "Texte" },
    })
  ).id;
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

describe("route handlers", () => {
  for (const [name, call] of Object.entries(routes)) {
    it(`${name} refuse une requête sans session (401)`, async () => {
      expect((await call()).status).toBe(401);
    });

    it(`${name} refuse une session non membre (403)`, async () => {
      await signInAsExMember();
      expect((await call()).status).toBe(403);
    });
  }

  it("upload-url renvoie une clé générée côté serveur et une URL PUT", async () => {
    await signIn(MEMBER_ID);
    const res = await requestUploadUrl();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: string; url: string };
    expect(body.key).toMatch(/^ideas\/[0-9a-f-]{36}\.png$/);
    expect(body.url).toContain(body.key);
  });

  it("upload-url refuse un type d'image non autorisé (400)", async () => {
    await signIn(MEMBER_ID);
    const res = await uploadUrlRoute.POST(
      new Request("http://localhost:3000/api/ideas/upload-url", {
        method: "POST",
        headers: { cookie: request.headers.get("cookie") ?? "" },
        body: JSON.stringify({ contentType: "image/svg+xml", size: 100 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("l'image d'une idée est refusée à un membre non admin (403)", async () => {
    await signIn(MEMBER_ID);
    expect((await requestIdeaImage()).status).toBe(403);
  });

  it("l'image d'une idée sans image renvoie 404 à un admin", async () => {
    await signIn(ADMIN_ID);
    expect((await requestIdeaImage()).status).toBe(404);
  });
});
