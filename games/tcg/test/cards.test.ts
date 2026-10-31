import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  CardInputError,
  createCard,
  createSet,
  createCardImageUpload,
  EFFECTS,
  effectText,
  ensureSet,
  getCard,
  importCards,
  listCards,
  moveCards,
  paramsSchema,
  setCardImage,
  updateCard,
  updateCards,
} from "../src/index";

const ADMIN = { discordId: "100000000000000001" };
const MEMBER = { discordId: "100000000000000002" };

const BASE = {
  name: "Carte test",
  rarity: "common",
  type: "Créature",
  family: "Test",
  cost: 2,
  power: 3,
} as const;

let setId = "";

beforeEach(async () => {
  await truncateTestDb();
  setId = (await ensureSet(ADMIN, { code: "S1", name: "Set de test" })).id;
});

describe("catalogue d'effets", () => {
  it("a des clés uniques, une carte Snap et un texte pour les réglages par défaut", () => {
    const keys = EFFECTS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const effect of EFFECTS) {
      expect(effect.snap).not.toBe("");
      expect(effectText(effect.key, { family: "Test", name: "un jeton" })).toMatch(/\.$/);
    }
  });

  it("borne les réglages", () => {
    const effect = EFFECTS.find((e) => e.key === "reveal_buff_two_allies");
    if (!effect) throw new Error("effet manquant");
    expect(paramsSchema(effect).parse({ amount: "3", count: 2 })).toEqual({ amount: 3, count: 2 });
    expect(() => paramsSchema(effect).parse({ amount: 3, count: 9 })).toThrow(ZodError);
    expect(() => paramsSchema(effect).parse({ amount: 3, count: 1, autre: 2 })).toThrow(ZodError);
  });
});

describe("createCard", () => {
  it("réservé aux admins", async () => {
    await expect(createCard(MEMBER, { ...BASE, setId })).rejects.toThrow("Réservé aux admins.");
  });

  it("numérote à la suite et propose le texte de l'effet", async () => {
    const first = await createCard(ADMIN, { ...BASE, setId });
    const second = await createCard(ADMIN, {
      ...BASE,
      setId,
      name: "Avec effet",
      effectKey: "reveal_debuff_weakest_enemy_silence",
      effectParams: { amount: 2 },
    });
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first.effectText).toBe("");
    expect(second.effectText).toBe(
      "Révélation : −2 à la carte adverse la plus faible ici, et retire son texte.",
    );
    expect(second.setCode).toBe("S1");
  });

  it("accepte les sept raretés, épique comprise", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId, rarity: "epic" });
    expect(card.rarity).toBe("epic");
    await expect(
      createCard(ADMIN, { ...BASE, setId, rarity: "mythique" as "epic" }),
    ).rejects.toThrow(ZodError);
  });

  it("garde le cadrage de l'illustration, borné", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    expect(card.imageFrame).toBeNull();
    const framed = await updateCard(ADMIN, card.id, {
      ...BASE,
      imageFrame: { x: 30, y: 70, zoom: 1.5 },
    });
    expect(framed.imageFrame).toEqual({ x: 30, y: 70, zoom: 1.5 });
    expect((await updateCard(ADMIN, card.id, { ...BASE, imageFrame: null })).imageFrame).toBeNull();
    await expect(
      updateCard(ADMIN, card.id, { ...BASE, imageFrame: { x: 50, y: 50, zoom: 9 } }),
    ).rejects.toThrow(ZodError);
  });

  it("refuse un effet inconnu ou mal réglé", async () => {
    await expect(createCard(ADMIN, { ...BASE, setId, effectKey: "inconnu" })).rejects.toThrow(
      ZodError,
    );
    await expect(
      createCard(ADMIN, {
        ...BASE,
        setId,
        effectKey: "reveal_buff_hand",
        effectParams: { amount: 0 },
      }),
    ).rejects.toThrow(ZodError);
  });
});

describe("variantes", () => {
  it("reprennent les stats de la carte de base, qui les leur recopie", async () => {
    const base = await createCard(ADMIN, {
      ...BASE,
      setId,
      effectKey: "end_of_turn_grow",
      effectParams: { amount: 1 },
    });
    const variant = await createCard(ADMIN, {
      ...BASE,
      setId,
      name: "Carte test (full art)",
      rarity: "sr",
      cost: 6,
      power: 1,
      baseCardId: base.id,
    });
    expect(variant).toMatchObject({
      cost: 2,
      power: 3,
      effectKey: "end_of_turn_grow",
      rarity: "sr",
    });

    await updateCard(ADMIN, base.id, { ...BASE, cost: 4, power: 7, effectKey: null });
    const [, after] = await listCards(ADMIN, { setId });
    expect(after).toMatchObject({ cost: 4, power: 7, effectKey: null, effectText: "" });

    // Sur la variante, les stats envoyées sont ignorées.
    const edited = await updateCard(ADMIN, variant.id, {
      ...BASE,
      name: "Renommée",
      rarity: "ssr",
      cost: 0,
    });
    expect(edited).toMatchObject({ name: "Renommée", rarity: "ssr", cost: 4 });
  });

  it("pas de variante d'une variante", async () => {
    const base = await createCard(ADMIN, { ...BASE, setId });
    const variant = await createCard(ADMIN, { ...BASE, setId, baseCardId: base.id });
    await expect(createCard(ADMIN, { ...BASE, setId, baseCardId: variant.id })).rejects.toThrow(
      CardInputError,
    );
  });
});

describe("importCards", () => {
  const file = {
    set: { code: "S1", name: "Set de test" },
    cards: [
      { ...BASE, name: "Idée A", ideaId: "idea-a" },
      {
        ...BASE,
        name: "Idée B",
        ideaId: "idea-b",
        effectKey: "reveal_draw",
      },
    ],
  };

  it("crée les cartes à la suite, puis ignore les idées déjà importées", async () => {
    await createCard(ADMIN, { ...BASE, setId });
    expect(await importCards(ADMIN, file)).toEqual({ created: 2, skipped: 0 });
    expect(await importCards(ADMIN, file)).toEqual({ created: 0, skipped: 2 });
    const cards = await listCards(ADMIN, { setId });
    expect(cards.map((c) => [c.number, c.name])).toEqual([
      [1, "Carte test"],
      [2, "Idée A"],
      [3, "Idée B"],
    ]);
    expect(cards[2]?.effectText).toBe("Révélation : chaque joueur pioche une carte.");
  });

  it("tout ou rien, avec la carte fautive dans le message", async () => {
    const bad = { ...file, cards: [...file.cards, { ...BASE, name: "Trop chère", cost: 9 }] };
    await expect(importCards(ADMIN, bad)).rejects.toThrow(
      "Carte 3 (Trop chère) : Mana : 8 maximum.",
    );
    expect(await db.tcgCard.count()).toBe(0);
  });
});

describe("updateCards", () => {
  it("change coût, puissance et effet, retrouve la carte par son idée, garde le reste", async () => {
    await importCards(ADMIN, {
      set: { code: "S1", name: "Set de test" },
      cards: [{ ...BASE, name: "Idée A", ideaId: "idea-a", flavor: "Garde-moi." }],
    });
    const [base] = await listCards(ADMIN, { setId });
    await createCard(ADMIN, { ...BASE, setId, name: "Idée A (full art)", baseCardId: base?.id });
    const done = await updateCards(ADMIN, {
      updates: [
        {
          ideaId: "idea-a",
          cost: 6,
          power: 10,
          effectKey: "reveal_move_allies_left",
          effectText: "Révélation : ÇA TOURNE !",
        },
      ],
    });
    expect(done).toEqual({ updated: 1 });
    const [card, variant] = await listCards(ADMIN, { setId });
    expect(card).toMatchObject({
      name: "Idée A",
      flavor: "Garde-moi.",
      number: 1,
      cost: 6,
      power: 10,
      effectKey: "reveal_move_allies_left",
      effectText: "Révélation : ÇA TOURNE !",
    });
    expect(variant).toMatchObject({ cost: 6, power: 10, effectKey: "reveal_move_allies_left" });

    // Nouvel effet sans texte : le texte proposé par le catalogue.
    await updateCards(ADMIN, { updates: [{ ideaId: "idea-a", effectKey: "reveal_draw" }] });
    expect((await getCard(ADMIN, card?.id ?? ""))?.effectText).toBe(
      "Révélation : chaque joueur pioche une carte.",
    );
  });

  it("départage par le nom, tout ou rien, admins seulement", async () => {
    await createCard(ADMIN, { ...BASE, setId, name: "Un", ideaId: "idea-x" });
    await createCard(ADMIN, { ...BASE, setId, name: "Deux", ideaId: "idea-x" });
    await expect(updateCards(ADMIN, { updates: [{ ideaId: "idea-x", cost: 1 }] })).rejects.toThrow(
      "Carte 1 (idea-x) : plusieurs cartes possibles, précise son nom.",
    );
    await expect(
      updateCards(ADMIN, {
        updates: [
          { ideaId: "idea-x", name: "Deux", cost: 1 },
          { ideaId: "idea-y", name: "Absente", cost: 1 },
        ],
      }),
    ).rejects.toThrow("Carte 2 (Absente) : aucune carte pour cette idée.");
    await expect(
      updateCards(ADMIN, { updates: [{ ideaId: "idea-x", name: "Un", effectKey: "inconnu" }] }),
    ).rejects.toThrow("Carte 1 (Un) : Effet inconnu.");
    expect((await listCards(ADMIN, { setId })).map((c) => c.cost)).toEqual([2, 2]);
    await expect(
      updateCards(MEMBER, { updates: [{ ideaId: "idea-x", name: "Un", cost: 1 }] }),
    ).rejects.toThrow("Réservé aux admins.");
  });
});

describe("illustration", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

  it("s'envoie par URL présignée, puis se pose sur la carte", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    const { key, url } = await createCardImageUpload(ADMIN, {
      contentType: "image/png",
      size: png.length,
    });
    expect(key).toMatch(/^cards\/[0-9a-f-]{36}\.png$/);
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: png,
    });
    expect(res.status).toBe(200);
    expect((await setCardImage(ADMIN, card.id, key)).imageKey).toBe(key);
  });

  it("refuse une clé jamais envoyée, inventée, ou un format non image", async () => {
    const card = await createCard(ADMIN, { ...BASE, setId });
    const { key } = await createCardImageUpload(ADMIN, { contentType: "image/png", size: 10 });
    await expect(setCardImage(ADMIN, card.id, key)).rejects.toThrow(CardInputError);
    await expect(setCardImage(ADMIN, card.id, "ideas/autre.png")).rejects.toThrow(ZodError);
    await expect(
      createCardImageUpload(ADMIN, { contentType: "image/gif", size: 10 }),
    ).rejects.toThrow(ZodError);
    await expect(
      createCardImageUpload(MEMBER, { contentType: "image/png", size: 10 }),
    ).rejects.toThrow("Réservé aux admins.");
  });
});

describe("réserve et sets", () => {
  it("crée une carte dans la réserve, sans numéro", async () => {
    const card = await createCard(ADMIN, { ...BASE });
    expect(card).toMatchObject({ setId: null, setCode: null, number: null });
    expect(await listCards(ADMIN, { setId: null })).toHaveLength(1);
  });

  it("range des cartes dans un set, puis renumérote ce qui en sort", async () => {
    const a = await createCard(ADMIN, { ...BASE, name: "A", setId });
    await createCard(ADMIN, { ...BASE, name: "B", setId });
    await createCard(ADMIN, { ...BASE, name: "C", setId });
    const r = await createCard(ADMIN, { ...BASE, name: "R" });
    expect(await moveCards(ADMIN, [a.id, r.id], null)).toEqual({ moved: 1 });
    const left = await listCards(ADMIN, { setId });
    expect(left.map((x) => [x.name, x.number])).toEqual([
      ["B", 1],
      ["C", 2],
    ]);
    await moveCards(ADMIN, [r.id, a.id], setId);
    const after = await listCards(ADMIN, { setId });
    expect(after.map((x) => [x.name, x.number])).toEqual([
      ["B", 1],
      ["C", 2],
      ["R", 3],
      ["A", 4],
    ]);
  });

  it("refuse un set inconnu, une carte inconnue, un code de set déjà pris", async () => {
    const card = await createCard(ADMIN, { ...BASE });
    await expect(moveCards(ADMIN, [card.id], "inconnu")).rejects.toThrow(CardInputError);
    await expect(moveCards(ADMIN, ["inconnue"], setId)).rejects.toThrow(CardInputError);
    await expect(createSet(ADMIN, { code: "S1", name: "Doublon" })).rejects.toThrow(
      "Le set S1 existe déjà.",
    );
    await expect(moveCards(MEMBER, [card.id], setId)).rejects.toThrow("Réservé aux admins.");
  });

  it("une idée peut donner plusieurs cartes", async () => {
    await createCard(ADMIN, { ...BASE, ideaId: "idea-x" });
    await createCard(ADMIN, { ...BASE, name: "Autre version", ideaId: "idea-x", setId });
    expect(await listCards(ADMIN, { ideaId: "idea-x" })).toHaveLength(2);
  });

  it("importe dans la réserve un fichier sans set", async () => {
    expect(await importCards(ADMIN, { cards: [{ ...BASE, ideaId: "idea-y" }] })).toEqual({
      created: 1,
      skipped: 0,
    });
    expect(await listCards(ADMIN, { setId: null })).toHaveLength(1);
  });
});
