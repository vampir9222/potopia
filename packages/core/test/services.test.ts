import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countUnread,
  EVENT_COMMIT_GRACE_MS,
  getUsersByIds,
  getVisibleApps,
  listEventsSince,
  listNotifications,
  listRecentEvents,
  markAllAsRead,
  markAsRead,
  MAX_RECENT_EVENTS,
  notify,
  notifyAdmins,
  publishEvent,
} from "../src/index";

const ADMIN_ID = "100000000000000001";

async function createUser(discordId: string): Promise<string> {
  const user = await db.user.create({
    data: {
      id: `user-${discordId}`,
      discordId,
      name: `Joueur ${discordId.slice(-3)}`,
      email: `${discordId}@example.test`,
    },
  });
  return user.id;
}

beforeEach(truncateTestDb);

describe("registre des apps", () => {
  it("retire GOTY pour tous les rôles lorsque le module est désactivé", () => {
    try {
      vi.stubEnv("GOTY_ENABLED", "false");
      for (const role of ["member", "admin"] as const)
        expect(getVisibleApps({ role }).some((app) => app.id === "goty")).toBe(false);
      vi.stubEnv("GOTY_ENABLED", "true");
      expect(getVisibleApps({ role: "member" }).some((app) => app.id === "goty")).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("getVisibleApps filtre par rôle", () => {
    expect(getVisibleApps({ role: "member" }).map((a) => a.id)).toEqual([
      "goty",
      "trois",
      "agents",
      "ideas",
      "cards",
    ]);
    expect(getVisibleApps({ role: "admin" }).map((a) => a.id)).toEqual([
      "goty",
      "trois",
      "agents",
      "ideas",
      "cards",
      "admin",
    ]);
  });
});

describe("users", () => {
  it("getUsersByIds ignore les doublons et les IDs inconnus", async () => {
    const id = await createUser("100000000000000002");
    const users = await getUsersByIds([id, id, "inconnu"]);
    expect(users.map((u) => u.id)).toEqual([id]);
  });
});

describe("notifications", () => {
  it("notify puis markAsRead", async () => {
    const userId = await createUser("100000000000000002");
    const n = await notify({ userId, title: "Tu as été crédité", link: "/" });
    expect(await countUnread(userId)).toBe(1);

    expect(await markAsRead({ userId, notificationId: n.id })).toBe(true);
    expect(await countUnread(userId)).toBe(0);
    expect((await listNotifications(userId))[0]?.readAt).toBeInstanceOf(Date);
  });

  it("markAsRead ne touche pas la notification d'un autre", async () => {
    const owner = await createUser("100000000000000002");
    const other = await createUser("100000000000000003");
    const n = await notify({ userId: owner, title: "Privée" });

    expect(await markAsRead({ userId: other, notificationId: n.id })).toBe(false);
    expect(await countUnread(owner)).toBe(1);
  });

  it("markAllAsRead ne lit que les notifications de l'utilisateur", async () => {
    const a = await createUser("100000000000000002");
    const b = await createUser("100000000000000003");
    await notify({ userId: a, title: "Un" });
    await notify({ userId: a, title: "Deux" });
    await notify({ userId: b, title: "Trois" });

    expect(await markAllAsRead({ userId: a })).toBe(2);
    expect(await countUnread(b)).toBe(1);
  });

  it("refuse un lien externe", async () => {
    const userId = await createUser("100000000000000002");
    await expect(notify({ userId, title: "x", link: "https://example.test" })).rejects.toThrow();
    await expect(notify({ userId, title: "x", link: "//example.test" })).rejects.toThrow();
  });

  it("notifyAdmins ne notifie que les admins de l'env", async () => {
    const admin = await createUser(ADMIN_ID);
    const member = await createUser("100000000000000002");

    expect(await notifyAdmins({ title: "Nouvelle idée reçue" })).toBe(1);
    expect(await countUnread(admin)).toBe(1);
    expect(await countUnread(member)).toBe(0);
  });
});

describe("activité", () => {
  it("publishEvent puis listRecentEvents, du plus récent au plus ancien", async () => {
    const userId = await createUser("100000000000000002");
    await publishEvent({ userId, app: "ideas", type: "first" });
    await publishEvent({ userId, app: "ideas", type: "second", payload: { n: 2 } });

    const events = await listRecentEvents(10);
    expect(events.map((e) => e.type)).toEqual(["second", "first"]);
    expect(events[1]?.payload).toEqual({});
  });

  it("listRecentEvents ne renvoie jamais plus de MAX_RECENT_EVENTS", async () => {
    const userId = await createUser("100000000000000002");
    await db.activityEvent.createMany({
      data: Array.from({ length: MAX_RECENT_EVENTS + 5 }, (_, i) => ({
        userId,
        app: "ideas",
        type: `e${i}`,
      })),
    });
    expect(await listRecentEvents(1000)).toHaveLength(MAX_RECENT_EVENTS);
  });

  it("listEventsSince livre un événement antidaté de quelques secondes (transaction validée tard)", async () => {
    const userId = await createUser("100000000000000002");
    const since = new Date();
    await db.activityEvent.createMany({
      data: [
        { userId, app: "ideas", type: "late", createdAt: new Date(since.getTime() - 5_000) },
        {
          userId,
          app: "ideas",
          type: "old",
          createdAt: new Date(since.getTime() - EVENT_COMMIT_GRACE_MS - 1_000),
        },
      ],
    });
    expect((await listEventsSince(since)).map((e) => e.type)).toEqual(["late"]);
  });

  it("publishEvent respecte la transaction passée en option", async () => {
    const userId = await createUser("100000000000000002");
    await expect(
      db.$transaction(async (tx) => {
        await publishEvent({ userId, app: "ideas", type: "rolled_back" }, { tx });
        expect(await tx.activityEvent.count()).toBe(1);
        throw new Error("annulation");
      }),
    ).rejects.toThrow("annulation");
    expect(await db.activityEvent.count()).toBe(0);

    await db.$transaction(async (tx) => {
      await publishEvent({ userId, app: "ideas", type: "committed" }, { tx });
    });
    expect(await db.activityEvent.count()).toBe(1);
  });
});
