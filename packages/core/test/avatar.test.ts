import { randomConfig, type AvatarConfig } from "@app/avatar";
import { fsSpriteLoader } from "@app/avatar/server";
import type * as assets from "@app/avatar-assets";
import { catalog, palettes, type Catalog } from "@app/avatar-assets";
import { spritesDir } from "@app/avatar-assets/fs";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { headObject, putObject } from "@app/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AvatarConfigError,
  ensureAvatar,
  ensureMissingAvatars,
  getAvatar,
  listEventsSince,
  listPlaceMembers,
  saveAvatar,
  validateAvatarConfig,
} from "../src/index";

// Catalogue réel, plus un chapeau à débloquer (aucun pour l'instant dans les données LPC).
vi.mock("@app/avatar-assets", async (importOriginal) => {
  const real = await importOriginal<typeof assets>();
  const hat = real.catalog.items.find((i) => i.category === "hat" && i.morphs.includes("male"));
  if (!hat) throw new Error("Aucun chapeau dans le catalogue.");
  const locked = { ...hat, id: "locked_hat", unlock: { item: "locked_hat" } };
  const catalog: Catalog = { ...real.catalog, items: [...real.catalog.items, locked] };
  return { ...real, catalog };
});

const sprites = fsSpriteLoader(spritesDir);

async function createUser(id: string, name = `Joueur ${id}`): Promise<string> {
  await db.user.create({ data: { id, name, email: `${id}@example.test` } });
  return id;
}

/** Config valide et stable : premier tirage d'un générateur fixe, en morphologie « male ». */
function validConfig(): AvatarConfig {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (;;) {
    const config = randomConfig(catalog, palettes, rng);
    if (config.morph === "male") return config;
  }
}

function itemOf(category: string, filter: (morphs: string[]) => boolean) {
  const item = catalog.items.find((i) => i.category === category && filter(i.morphs));
  if (!item) throw new Error(`Aucun élément ${category}.`);
  return item;
}

beforeEach(truncateTestDb);

describe("validation de la config d'avatar", () => {
  it("accepte une config cohérente", async () => {
    const userId = await createUser("u1");
    await expect(validateAvatarConfig(userId, validConfig())).resolves.toMatchObject({
      morph: "male",
    });
  });

  it("refuse un élément inexistant", async () => {
    const userId = await createUser("u1");
    const config = validConfig();
    config.items.hat = { id: "chapeau_imaginaire" };
    await expect(validateAvatarConfig(userId, config)).rejects.toThrow("Élément inconnu");
  });

  it("refuse un élément incompatible avec la morphologie", async () => {
    const userId = await createUser("u1");
    const config = validConfig();
    // Haut qui n'existe qu'en « female » (la config de test est « male »).
    const item = itemOf("torso", (m) => !m.includes("male"));
    config.items[item.category] = { id: item.id };
    await expect(validateAvatarConfig(userId, config)).rejects.toThrow(
      "n'existe pas pour cette morphologie",
    );
  });

  it("refuse un élément à débloquer non possédé, l'accepte une fois possédé", async () => {
    const userId = await createUser("u1");
    const config = validConfig();
    config.items.hat = { id: "locked_hat" };
    await expect(validateAvatarConfig(userId, config)).rejects.toBeInstanceOf(AvatarConfigError);
    await db.userAvatarItem.create({ data: { userId, itemId: "locked_hat" } });
    await expect(validateAvatarConfig(userId, config)).resolves.toBeTruthy();
  });

  it("refuse une couleur hors palette et une forme invalide", async () => {
    const userId = await createUser("u1");
    await expect(
      validateAvatarConfig(userId, { ...validConfig(), skin: "ulpc.inconnue" }),
    ).rejects.toThrow("Couleur de peau invalide");
    await expect(validateAvatarConfig(userId, { v: 1, morph: "dragon" })).rejects.toThrow(
      "Avatar invalide",
    );
  });
});

describe("enregistrement", () => {
  it("compose la planche dans R2, enregistre l'avatar et publie avatar/updated", async () => {
    const userId = await createUser("u1");
    const since = new Date(Date.now() - 1000);
    const avatar = await saveAvatar({ userId, config: validConfig(), sprites });

    expect(avatar.sheetKey).toBe(`avatars/${userId}-${avatar.configHash}.png`);
    const object = await headObject(avatar.sheetKey);
    expect(object?.contentType).toBe("image/png");
    expect(object?.contentLength).toBeGreaterThan(1000);
    const events = await listEventsSince(since);
    expect(events.map((e) => [e.app, e.type, e.payload])).toEqual([["avatar", "updated", {}]]);
  });

  it("même config : rien ne change ; nouvelle config : nouvelle clé, ancienne planche supprimée", async () => {
    const userId = await createUser("u1");
    const config = validConfig();
    const first = await saveAvatar({ userId, config, sprites });
    const again = await saveAvatar({ userId, config: structuredClone(config), sprites });
    expect(again.configHash).toBe(first.configHash);
    expect(await db.activityEvent.count()).toBe(1);

    const changed = await saveAvatar({
      userId,
      config: { ...config, eyes: config.eyes === "ulpc.green" ? "ulpc.blue" : "ulpc.green" },
      sprites,
    });
    expect(changed.configHash).not.toBe(first.configHash);
    expect(await headObject(changed.sheetKey)).not.toBeNull();
    expect(await headObject(first.sheetKey)).toBeNull();
    expect(await db.activityEvent.count()).toBe(2);
  });

  it("une config refusée n'écrit rien", async () => {
    const userId = await createUser("u1");
    await expect(
      saveAvatar({ userId, config: { ...validConfig(), morph: "dragon" }, sprites }),
    ).rejects.toThrow();
    expect(await getAvatar(userId)).toBeNull();
    expect(await db.activityEvent.count()).toBe(0);
  });
});

describe("première visite", () => {
  it("crée un avatar aléatoire valide, sans événement, une seule fois", async () => {
    const userId = await createUser("u1");
    const avatar = await ensureAvatar({ userId, sprites });
    await expect(validateAvatarConfig(userId, avatar.config)).resolves.toBeTruthy();
    expect(await headObject(avatar.sheetKey)).not.toBeNull();
    expect(await db.activityEvent.count()).toBe(0);

    const again = await ensureAvatar({ userId, sprites });
    expect(again.configHash).toBe(avatar.configHash);
  });

  it("recompose la planche quand l'empreinte stockée ne correspond plus (catalogue réimporté) et supprime l'ancienne", async () => {
    const userId = await createUser("u1");
    const avatar = await ensureAvatar({ userId, sprites });
    const oldKey = `avatars/${userId}-ancien.png`;
    await putObject({ key: oldKey, body: new Uint8Array([1, 2, 3]), contentType: "image/png" });
    await db.avatar.update({
      where: { userId },
      data: { configHash: "ancien", sheetKey: oldKey },
    });
    const refreshed = await ensureAvatar({ userId, sprites });
    expect(refreshed.configHash).toBe(avatar.configHash);
    expect(refreshed.config).toEqual(avatar.config);
    expect(await headObject(oldKey)).toBeNull();
    expect(await headObject(refreshed.sheetKey)).not.toBeNull();
  });
});

describe("la place", () => {
  it("liste les membres avec avatar et leur dernière activité", async () => {
    const a = await createUser("u1", "Alice");
    const b = await createUser("u2", "Bob");
    await createUser("u3", "Sans avatar");
    await ensureAvatar({ userId: a, sprites });
    await ensureAvatar({ userId: b, sprites });
    const old = new Date("2026-01-01T00:00:00Z");
    await db.user.update({ where: { id: b }, data: { createdAt: old } });
    await db.activityEvent.create({
      data: { userId: b, app: "ideas", type: "x", createdAt: new Date("2026-02-01T00:00:00Z") },
    });

    const members = await listPlaceMembers();
    expect(members.map((m) => m.name)).toEqual(["Alice", "Bob"]);
    expect(members[1]?.lastSeenAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("membres sans avatar", () => {
  it("ensureMissingAvatars en crée quelques-uns à la fois", async () => {
    for (const id of ["u1", "u2", "u3"]) await createUser(id);
    expect(await ensureMissingAvatars({ sprites, limit: 2 })).toBe(2);
    expect(await db.avatar.count()).toBe(2);
    expect(await ensureMissingAvatars({ sprites, limit: 2 })).toBe(1);
    expect(await ensureMissingAvatars({ sprites })).toBe(0);
  });

  it("un avatar qui échoue est signalé sans faire échouer le lot", async () => {
    for (const id of ["u1", "u2"]) await createUser(id);
    const failing = async () => {
      throw new Error("sprite illisible");
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(ensureMissingAvatars({ sprites: failing })).resolves.toBe(0);
      expect(error).toHaveBeenCalledTimes(2);
    } finally {
      error.mockRestore();
    }
    expect(await db.avatar.count()).toBe(0);
    // Le lot suivant n'est pas bloqué par les échecs précédents.
    expect(await ensureMissingAvatars({ sprites })).toBe(2);
  });
});
