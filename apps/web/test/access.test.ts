import type { PlaceSnapshot } from "@app/avatar/ui";
import {
  countUnread,
  ensureAvatar,
  ForbiddenError,
  getAvatar,
  notify,
  publishEvent,
  UnauthorizedError,
} from "@app/core";
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
vi.mock("next/cache", () => ({ refresh: () => undefined, revalidatePath: () => undefined }));
// Tâches après la réponse (avatars manquants) : ignorées en test.
vi.mock("next/server", () => ({ after: () => undefined }));
// next/font est transformé à la compilation par Next : hors Next, une police factice suffit.
vi.mock("next/font/google", () => {
  const font = () => ({ className: "", variable: "", style: { fontFamily: "" } });
  const names = ["Anton", "Bangers", "Caveat", "Cinzel", "Comic_Neue", "EB_Garamond", "Lato"];
  names.push("Libre_Franklin", "Nunito", "Orbitron", "Press_Start_2P", "Space_Grotesk");
  names.push("Spectral", "VT323");
  return Object.fromEntries(names.map((name) => [name, font]));
});

const { markAllNotificationsAsRead, markNotificationAsRead } =
  await import("@/app/actions/notifications");
const { adjustBalance } = await import("@/app/(platform)/admin/economy/actions");
const { loadMoreIdeas } = await import("@/app/(platform)/admin/ideas/actions");
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
const ideasExportRoute = await import("@/app/api/admin/ideas/export/route");
const cardVotesRoute = await import("@/app/api/admin/cards/votes/route");
const { default: CardsVotePage } = await import("@/app/(platform)/cartes/page");
const { rateDesignAction } = await import("@/app/(platform)/cartes/actions");
const showcaseImageRoute = await import("@/app/api/cartes/exemple/route");
const agentsGamesRoute = await import("@/app/api/agents/games/route");
const agentsGameRoute = await import("@/app/api/agents/games/[id]/route");
const agentsLeaderboardRoute = await import("@/app/api/agents/leaderboard/route");
const { default: AgentsPage } = await import("@/app/(platform)/agents/page");
const { default: AgentsGamePage } = await import("@/app/(platform)/agents/[id]/page");
const troisGameRoute = await import("@/app/api/trois/game/route");
const troisGuessRoute = await import("@/app/api/trois/guess/route");
const troisPracticeRoute = await import("@/app/api/trois/practice/route");
const troisLeaderboardRoute = await import("@/app/api/trois/leaderboard/route");
const { default: TroisPage } = await import("@/app/(platform)/trois/page");
const { default: WalletPage } = await import("@/app/(platform)/wallet/page");
const { default: AvatarPage } = await import("@/app/(platform)/avatar/page");
const { default: CreditsPage } = await import("@/app/(platform)/credits/page");
const { saveAvatarAction } = await import("@/app/(platform)/avatar/actions");
const { sprites } = await import("@/lib/avatar");
const avatarSheetRoute = await import("@/app/api/avatars/[userId]/[hash]/route");
const placeRoute = await import("@/app/api/place/route");

const ADMIN_ID = "100000000000000001";
const MEMBER_ID = "100000000000000002";
const discord = new FakeDiscord();

function rateForm(stars = "4"): FormData {
  const form = new FormData();
  form.set("designId", "pixel");
  form.set("stars", stars);
  form.set("comment", "Sympa");
  return form;
}

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
  rateDesignAction: () => rateDesignAction({ status: "idle" }, rateForm()),
  loadMoreIdeas: () => loadMoreIdeas({}, ideaId),
  adjustBalance: () => adjustBalance({ status: "idle" }, adjustForm("inconnu")),
  sendIdea: () => sendIdea({ status: "idle" }, ideaForm()),
  saveAvatarAction: () => saveAvatarAction({}),
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
  "GET /api/admin/ideas/export": () => ideasExportRoute.GET(withCookie("/api/admin/ideas/export")),
  "GET /api/admin/cards/votes": () => cardVotesRoute.GET(withCookie("/api/admin/cards/votes")),
  "GET /api/cartes/exemple": () => showcaseImageRoute.GET(withCookie("/api/cartes/exemple")),
  "GET /api/agents/games": () => agentsGamesRoute.GET(withCookie("/api/agents/games")),
  "POST /api/agents/games": () =>
    agentsGamesRoute.POST(withCookie("/api/agents/games", { partnerId: "inconnu" })),
  "GET /api/agents/games/[id]": () =>
    agentsGameRoute.GET(withCookie("/api/agents/games/inconnue"), {
      params: Promise.resolve({ id: "inconnue" }),
    }),
  "POST /api/agents/games/[id]": () =>
    agentsGameRoute.POST(withCookie("/api/agents/games/inconnue", { action: "stop" }), {
      params: Promise.resolve({ id: "inconnue" }),
    }),
  "GET /api/agents/leaderboard": () =>
    agentsLeaderboardRoute.GET(withCookie("/api/agents/leaderboard?period=all")),
  "GET /api/trois/game": () => troisGameRoute.GET(withCookie("/api/trois/game")),
  "POST /api/trois/guess": () =>
    troisGuessRoute.POST(withCookie("/api/trois/guess", { guess: "faire" })),
  "POST /api/trois/practice": () =>
    troisPracticeRoute.POST(withCookie("/api/trois/practice", { guess: "faire", slot: 0 })),
  "GET /api/trois/leaderboard": () =>
    troisLeaderboardRoute.GET(withCookie("/api/trois/leaderboard?period=week")),
  "GET /api/avatars/[userId]/[hash]": () => requestAvatarSheet("inconnu", "0123456789abcdef"),
  "GET /api/place": () => placeRoute.GET(withCookie("/api/place")),
};

function requestAvatarSheet(userId: string, hash: string): Promise<Response> {
  return avatarSheetRoute.GET(withCookie(`/api/avatars/${userId}/${hash}`), {
    params: Promise.resolve({ userId, hash }),
  });
}

/** Requête vers l'app avec les cookies de la requête courante (POST JSON si body). */
function withCookie(path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: body ? "POST" : "GET",
    headers: { cookie: request.headers.get("cookie") ?? "", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Pages et layouts protégés. */
const children = null;
const memberPages: Record<string, () => Promise<unknown>> = {
  "(platform)/layout": () => PlatformLayout({ children }),
  "(platform)/page": () => DashboardPage(),
  "ideas/page": () => IdeasPage(),
  "agents/page": () => AgentsPage(),
  "agents/[id]/page": () => AgentsGamePage({ params: Promise.resolve({ id: "inconnue" }) }),
  "trois/page": () => TroisPage(),
  "cartes/page": () => CardsVotePage({ searchParams: Promise.resolve({ onglet: "archives" }) }),
  "wallet/page": () => WalletPage({ searchParams: Promise.resolve({}) }),
  "avatar/page": () => AvatarPage(),
  "credits/page": () => CreditsPage(),
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

  it("loadMoreIdeas refuse un membre non admin (403)", async () => {
    await signIn(MEMBER_ID);
    await expect(loadMoreIdeas({}, ideaId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("loadMoreIdeas renvoie la page suivante à un admin, au défilement", async () => {
    await db.idea.createMany({
      data: Array.from({ length: 24 }, (_, i) => ({
        authorId: "auteur-fictif",
        title: `Idée ${i}`,
        description: "Texte",
        createdAt: new Date(Date.UTC(2020, 0, 1, 0, i)),
      })),
    });
    await signIn(ADMIN_ID);
    const first = await db.idea.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
    });
    const page = await loadMoreIdeas({}, first.at(-1)?.id ?? "");
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((i) => i.id)).not.toContain(first[0]?.id);
  });

  it("rateDesignAction : un membre vote, mais l'export des notes reste réservé aux admins", async () => {
    await signIn(MEMBER_ID);
    expect((await rateDesignAction({ status: "idle" }, rateForm())).status).toBe("ok");
    expect((await cardVotesRoute.GET(withCookie("/api/admin/cards/votes"))).status).toBe(403);
  });

  it("rateDesignAction enregistre la note de l'admin, et refuse une note invalide", async () => {
    await signIn(ADMIN_ID);
    expect((await rateDesignAction({ status: "idle" }, rateForm())).status).toBe("ok");
    const invalid = await rateDesignAction({ status: "idle" }, rateForm("9"));
    expect(invalid).toMatchObject({ status: "error", message: "Note de 0 à 5 étoiles." });

    const res = await cardVotesRoute.GET(withCookie("/api/admin/cards/votes"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.designs.find((d: { id: string }) => d.id === "pixel")).toMatchObject({
      average: 4,
      votes: [{ stars: 4, comment: "Sympa" }],
    });
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

  it("la planche d'un avatar redirige vers une URL présignée, 404 pour une autre empreinte", async () => {
    const userId = await signIn(MEMBER_ID);
    const avatar = await ensureAvatar({ userId, sprites });
    const res = await requestAvatarSheet(userId, avatar.configHash);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(avatar.sheetKey);
    expect(res.headers.get("cache-control")).toBe("private, max-age=600");
    expect((await requestAvatarSheet(userId, "0000000000000000")).status).toBe(404);
  });

  it("la place liste les membres et les événements récents, sans contenu", async () => {
    const userId = await signIn(MEMBER_ID);
    await ensureAvatar({ userId, sprites });
    const since = new Date(Date.now() - 1000).toISOString();
    await publishEvent({ userId, app: "avatar", type: "updated" });
    const res = await placeRoute.GET(withCookie(`/api/place?since=${since}`));
    const body = (await res.json()) as PlaceSnapshot;
    expect(body.members.map((m) => m.id)).toEqual([userId]);
    expect(body.members[0]?.sheetUrl).toMatch(/^\/api\/avatars\/.+\/[0-9a-f]{16}$/);
    expect(body.events.map((e) => [e.app, e.type])).toEqual([["avatar", "updated"]]);
    expect((await placeRoute.GET(withCookie("/api/place?since=hier"))).status).toBe(400);
  });

  it("saveAvatarAction refuse une config invalide et enregistre une config valide", async () => {
    const userId = await signIn(MEMBER_ID);
    const { config } = await ensureAvatar({ userId, sprites });
    expect(await saveAvatarAction({ ...config, morph: "dragon" })).toEqual({
      status: "error",
      message: "Avatar invalide.",
    });
    const next = { ...config, eyes: config.eyes === "ulpc.green" ? "ulpc.blue" : "ulpc.green" };
    expect(await saveAvatarAction(next)).toEqual({ status: "ok" });
    expect((await getAvatar(userId))?.config).toEqual(next);
  });

  it("l'export des idées est refusé à un membre non admin (403)", async () => {
    await signIn(MEMBER_ID);
    expect((await ideasExportRoute.GET(withCookie("/api/admin/ideas/export"))).status).toBe(403);
  });

  it("l'export des idées renvoie un fichier JSON à un admin, jamais mis en cache", async () => {
    await signIn(ADMIN_ID);
    const res = await ideasExportRoute.GET(withCookie("/api/admin/ideas/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="idees-/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.ideas[0]).toMatchObject({
      id: ideaId,
      title: "Titre",
      description: "Texte",
      author: "Membre inconnu",
      imageUrl: null,
    });
  });
});
