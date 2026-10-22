import { ForbiddenError, listNotifications, listRecentEvents } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createUploadUrl,
  getIdea,
  getIdeaImageUrl,
  InvalidImageError,
  listIdeas,
  submitIdea,
} from "../src/index";

const ADMIN = { id: "user-admin", discordId: "100000000000000001" };
const MEMBER = { id: "user-member", discordId: "100000000000000002" };
const OTHER = { id: "user-other", discordId: "100000000000000003" };

const idea = (n = 1) => ({ title: `Idée ${n}`, description: "Une carte qui fait quelque chose." });
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

/** Demande une URL puis envoie l'image comme le ferait le navigateur. */
async function uploadImage(userId: string, body = png, contentType = "image/png"): Promise<string> {
  const { key, url } = await createUploadUrl(userId, { contentType, size: body.length });
  const res = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body });
  expect(res.status).toBe(200);
  return key;
}

beforeEach(async () => {
  await truncateTestDb();
  await db.user.createMany({
    data: [ADMIN, MEMBER, OTHER].map((u) => ({
      ...u,
      name: u.id,
      email: `${u.id}@example.test`,
    })),
  });
});

describe("submitIdea", () => {
  it("enregistre l'idée et ne renvoie que { ok: true }", async () => {
    const result = await submitIdea(MEMBER.id, {
      ...idea(),
      concernedPeople: "",
      suggestedRarity: "rare",
      effectIdea: "Pioche deux cartes",
    });
    expect(result).toStrictEqual({ ok: true });

    const { items } = await listIdeas(ADMIN);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      authorId: MEMBER.id,
      suggestedRarity: "rare",
      concernedPeople: null,
      imageKey: null,
    });
  });

  it("l'événement d'activité et la notification ne contiennent aucun contenu", async () => {
    await submitIdea(MEMBER.id, { title: "Titre secret", description: "Contenu secret" });

    const events = await listRecentEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ app: "ideas", type: "idea_submitted", payload: {} });

    const [notification] = await listNotifications(ADMIN.id);
    expect(notification?.title).toBe("Nouvelle idée reçue");
    const everything = JSON.stringify({ events, notification });
    expect(everything).not.toContain("secret");
    // Les membres non admins ne sont pas notifiés.
    expect(await listNotifications(MEMBER.id)).toHaveLength(0);
  });

  it("valide les champs", async () => {
    const invalid = [
      { ...idea(), title: "" },
      { ...idea(), title: "x".repeat(101) },
      { ...idea(), description: "   " },
      { ...idea(), description: "x".repeat(2001) },
      { ...idea(), concernedPeople: "x".repeat(201) },
      { ...idea(), effectIdea: "x".repeat(1001) },
      { ...idea(), suggestedRarity: "mythique" },
    ];
    for (const input of invalid) await expect(submitIdea(MEMBER.id, input)).rejects.toThrow();
    expect(await db.idea.count()).toBe(0);
  });

  it("accepte les longueurs maximales", async () => {
    await submitIdea(MEMBER.id, {
      title: "x".repeat(100),
      description: "x".repeat(2000),
      concernedPeople: "x".repeat(200),
      effectIdea: "x".repeat(1000),
    });
    expect(await db.idea.count()).toBe(1);
  });

  it("n'impose pas de limite d'envoi", async () => {
    for (let i = 1; i <= 10; i++) await submitIdea(MEMBER.id, idea(i));
    expect(await db.idea.count()).toBe(10);
  });
});

describe("images", () => {
  it("envoie une idée avec image, lisible par l'admin via une URL présignée", async () => {
    const key = await uploadImage(MEMBER.id);
    expect(key).toMatch(/^ideas\/[0-9a-f-]{36}\.png$/);
    await submitIdea(MEMBER.id, { ...idea(), imageKey: key });

    const [stored] = (await listIdeas(ADMIN)).items;
    expect(stored?.imageKey).toBe(key);
    const url = await getIdeaImageUrl(ADMIN, stored?.id ?? "");
    const res = await fetch(url ?? "");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(png);
  });

  it("refuse une clé inventée par le client", async () => {
    await expect(
      submitIdea(MEMBER.id, { ...idea(), imageKey: "ideas/inventee.png" }),
    ).rejects.toBeInstanceOf(InvalidImageError);
  });

  it("refuse une clé émise pour un autre membre", async () => {
    const key = await uploadImage(OTHER.id);
    await expect(submitIdea(MEMBER.id, { ...idea(), imageKey: key })).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it("refuse une clé déjà utilisée", async () => {
    const key = await uploadImage(MEMBER.id);
    await submitIdea(MEMBER.id, { ...idea(1), imageKey: key });
    await expect(submitIdea(MEMBER.id, { ...idea(2), imageKey: key })).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it("refuse une clé émise mais dont l'image n'a jamais été envoyée", async () => {
    const { key } = await createUploadUrl(MEMBER.id, { contentType: "image/png", size: 10 });
    await expect(submitIdea(MEMBER.id, { ...idea(), imageKey: key })).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    // L'idée refusée ne laisse rien : ni idée, ni clé consommée.
    expect(await db.idea.count()).toBe(0);
    expect((await db.ideaUpload.findUniqueOrThrow({ where: { key } })).usedAt).toBeNull();
  });

  it("refuse les types et tailles d'image non autorisés", async () => {
    for (const contentType of ["image/gif", "image/svg+xml", "text/html"]) {
      await expect(createUploadUrl(MEMBER.id, { contentType, size: 100 })).rejects.toThrow();
    }
    await expect(
      createUploadUrl(MEMBER.id, { contentType: "image/png", size: 3 * 1024 * 1024 + 1 }),
    ).rejects.toThrow(/3 Mo/);
    await expect(
      createUploadUrl(MEMBER.id, { contentType: "image/png", size: 0 }),
    ).rejects.toThrow();
  });
});

describe("lecture réservée aux admins", () => {
  it("un non-admin reçoit ForbiddenError sur listIdeas, getIdea et l'image", async () => {
    await submitIdea(MEMBER.id, idea());
    const [stored] = (await listIdeas(ADMIN)).items;
    const id = stored?.id ?? "";

    // Même l'auteur ne relit pas son idée.
    await expect(listIdeas(MEMBER)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getIdea(MEMBER, id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getIdeaImageUrl(MEMBER, id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listIdeas({ discordId: null })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("filtre par auteur et par rareté, et pagine", async () => {
    await submitIdea(MEMBER.id, { ...idea(1), suggestedRarity: "rare" });
    await submitIdea(MEMBER.id, { ...idea(2), suggestedRarity: "common" });
    await submitIdea(OTHER.id, { ...idea(3), suggestedRarity: "rare" });

    expect((await listIdeas(ADMIN, { authorId: MEMBER.id })).items).toHaveLength(2);
    expect((await listIdeas(ADMIN, { rarity: "rare" })).items).toHaveLength(2);

    const page1 = await listIdeas(ADMIN, { limit: 2 });
    const page2 = await listIdeas(ADMIN, { limit: 2, cursor: page1.nextCursor ?? undefined });
    expect([...page1.items, ...page2.items].map((i) => i.title)).toEqual([
      "Idée 3",
      "Idée 2",
      "Idée 1",
    ]);
    expect(page2.nextCursor).toBeNull();
  });
});
