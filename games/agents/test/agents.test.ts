import { countUnread, listRecentEvents } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import words from "../data/words.json";
import { normalize, type GameView } from "../src/game";
import {
  AgentsError,
  createGame,
  duoLeaderboard,
  getGame,
  listGames,
  playMove,
} from "../src/index";
import { checkClue, dealKeys, drawWords } from "../src/rules";

const A = "user-a";
const B = "user-b";
const C = "user-c";

/**
 * Cartes connues d'avance (dans l'ordre des paires du jeu) :
 * 0-2 agents communs · 3-7 agents de A · 8-12 agents de B · 13 agent de A, assassin de B ·
 * 14 assassin de A, agent de B · 15 assassin commun · 16 assassin de A · 17 assassin de B ·
 * 18-24 témoins communs.
 */
const KEY_A = "GGG" + "GGGGG" + "NNNNN" + "G" + "A" + "A" + "A" + "N" + "NNNNNNN";
const KEY_B = "GGG" + "NNNNN" + "GGGGG" + "A" + "G" + "A" + "N" + "A" + "NNNNNNN";

/** Générateur déterministe pour les tirages. */
function seeded(seed = 1) {
  let s = seed;
  return (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % n;
  };
}

/** Partie entre A et B, cartes imposées, A donne le premier indice. */
async function newGame(): Promise<string> {
  const { id } = await createGame({ userId: A, partnerId: B });
  await db.agentsGame.update({ where: { id }, data: { keyA: KEY_A, keyB: KEY_B, clueSeat: 0 } });
  return id;
}

const clue = (userId: string, gameId: string, word = "indice", count = 2) =>
  playMove({ userId, gameId, move: { action: "clue", word, count } });
const guess = (userId: string, gameId: string, card: number) =>
  playMove({ userId, gameId, move: { action: "guess", card } });
const stop = (userId: string, gameId: string) =>
  playMove({ userId, gameId, move: { action: "stop" } });

async function expectAgentsError(promise: Promise<unknown>, status: number): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AgentsError);
  await expect(promise).rejects.toMatchObject({ status });
}

beforeEach(async () => {
  await truncateTestDb();
  await db.user.createMany({
    data: [A, B, C].map((id) => ({ id, name: id, email: `${id}@example.test` })),
  });
});

describe("mots", () => {
  it("plus de 1 500 mots, sans doublon", () => {
    const list = words as string[];
    expect(list.length).toBeGreaterThan(1500);
    expect(new Set(list.map(normalize)).size).toBe(list.length);
    expect(list.every((w) => w.trim() === w && w.length > 0 && w.length <= 20)).toBe(true);
  });

  it("une grille de 25 mots, sans deux mots trop proches", () => {
    const grid = drawWords(words as string[], seeded(7));
    expect(grid).toHaveLength(25);
    expect(new Set(grid).size).toBe(25);
    expect(drawWords(["lapin", "Lapins Crétins", ...grid], seeded(3))).not.toEqual(
      expect.arrayContaining(["lapin", "Lapins Crétins"]),
    );
  });
});

describe("cartes secrètes", () => {
  it("9 agents et 3 assassins par carte, 15 agents en tout, comme Codenames Duet", () => {
    for (let seed = 1; seed < 20; seed++) {
      const [a, b] = dealKeys(seeded(seed));
      const count = (key: string, c: string) => [...key].filter((x) => x === c).length;
      expect([count(a, "G"), count(a, "A"), count(b, "G"), count(b, "A")]).toEqual([9, 3, 9, 3]);
      const pairs = [...a].map((x, i) => x + b.charAt(i));
      expect(pairs.filter((p) => p === "GG")).toHaveLength(3);
      expect(pairs.filter((p) => p.includes("G"))).toHaveLength(15);
      expect(pairs.filter((p) => p === "AA")).toHaveLength(1);
    }
  });
});

describe("indices", () => {
  const grid = ["chat", "Lapins Crétins", "Tour Eiffel"];
  it("refuse un mot de la grille, un pluriel, plusieurs mots", () => {
    expect(() => checkClue("chat", grid)).toThrow(AgentsError);
    expect(() => checkClue("Chats", grid)).toThrow(AgentsError);
    expect(() => checkClue("lapin", grid)).toThrow(AgentsError);
    expect(() => checkClue("deux mots", grid)).toThrow(AgentsError);
    expect(() => checkClue("", grid)).toThrow(AgentsError);
  });
  it("accepte un mot sans rapport, même s'il en contient un autre", () => {
    expect(checkClue("château", grid)).toBe("château");
    expect(checkClue("Paris", grid)).toBe("Paris");
  });
});

describe("partie", () => {
  it("invite le partenaire, et ne crée pas deux parties en cours entre les mêmes", async () => {
    const first = await createGame({ userId: A, partnerId: B });
    expect(first.created).toBe(true);
    expect(await countUnread(B)).toBe(1);
    const again = await createGame({ userId: B, partnerId: A });
    expect(again).toEqual({ id: first.id, created: false });
    await expectAgentsError(createGame({ userId: A, partnerId: A }), 400);
    await expectAgentsError(createGame({ userId: A, partnerId: "inconnu" }), 404);
  });

  it("chacun ne voit que sa carte, et un autre membre ne voit rien", async () => {
    const id = await newGame();
    const viewA = await getGame({ userId: A, gameId: id });
    const viewB = await getGame({ userId: B, gameId: id });
    expect(viewA.cards.map((c) => c.mine).join("")).toBe(KEY_A);
    expect(viewB.cards.map((c) => c.mine).join("")).toBe(KEY_B);
    expect(viewA.cards.every((c) => c.theirs === undefined)).toBe(true);
    expect([viewA.role, viewB.role]).toEqual(["clue", "wait"]);
    await expectAgentsError(getGame({ userId: C, gameId: id }), 403);
  });

  it("un tour : agents trouvés, puis un témoin passe la main", async () => {
    const id = await newGame();
    await expectAgentsError(clue(B, id), 409);
    await expectAgentsError(clue(A, id, "chat ?"), 400);
    await clue(A, id, "indice", 2);
    expect(await countUnread(B)).toBe(2);
    await expectAgentsError(stop(B, id), 409);

    await guess(B, id, 0);
    let view: GameView = await guess(B, id, 3);
    expect(view.agentsLeft).toBe(13);
    view = await guess(B, id, 8); // témoin sur la carte de A, agent sur celle de B
    expect(view).toMatchObject({ turnsLeft: 8, mistakes: 1, phase: "clue", clueSeat: 1 });
    expect(view.cards[8]).toMatchObject({ found: false, bystanderTheirs: true });
    // déjà témoin pour A : B ne peut plus le toucher sur un indice de A, mais A le peut sur celui de B
    await clue(B, id, "autre", 1);
    view = await guess(A, id, 8);
    expect(view.cards[8]?.found).toBe(true);
    expect(view.history.map((h) => [h.turn, h.clue?.word, h.guesses.length])).toEqual([
      [1, "indice", 3],
      [2, "autre", 1],
    ]);
  });

  it("toucher un assassin fait perdre la partie", async () => {
    const id = await newGame();
    await clue(A, id);
    const view = await guess(B, id, 14);
    expect(view).toMatchObject({ status: "lost", role: "over" });
    expect(view.cards.every((c) => c.theirs !== undefined)).toBe(true);
    await expectAgentsError(guess(B, id, 0), 409);
    const [event] = await listRecentEvents(1);
    expect(event).toMatchObject({ app: "agents", type: "mission_completed" });
  });

  it("victoire : les 15 agents trouvés, classement des duos", async () => {
    const id = await newGame();
    await clue(A, id);
    for (const card of [0, 1, 2, 3, 4, 5, 6, 7]) await guess(B, id, card);
    // dernier agent de A : le tour s'arrête tout seul, B donne l'indice suivant
    let view = await guess(B, id, 13);
    expect(view).toMatchObject({ phase: "clue", clueSeat: 1, turnsLeft: 8, myAgentsLeft: 6 });
    await clue(B, id);
    for (const card of [8, 9, 10, 11, 12]) await guess(A, id, card);
    view = await guess(A, id, 14);
    expect(view).toMatchObject({ status: "won", turnsUsed: 2, agentsLeft: 0 });

    const { duos } = await duoLeaderboard(A, "all");
    expect(duos).toHaveLength(1);
    expect(duos[0]).toMatchObject({
      me: true,
      played: 1,
      wins: 1,
      best: { turns: 2, mistakes: 0 },
    });
    expect((await duoLeaderboard(C, "month")).duos[0]?.me).toBe(false);
  });

  it("après 9 tours, mort subite : la moindre erreur fait perdre", async () => {
    const id = await newGame();
    // 9 tours finis sur un témoin commun : A donne les indices aux tours impairs, B aux pairs
    for (let t = 0; t < 9; t++) {
      const giver = t % 2 === 0 ? A : B;
      const guesser = giver === A ? B : A;
      await clue(giver, id);
      await guess(guesser, id, 18 + Math.floor(t / 2));
    }
    let view = await getGame({ userId: A, gameId: id });
    expect(view).toMatchObject({ phase: "sudden", role: "sudden", turnsLeft: 0, mistakes: 9 });
    await expectAgentsError(clue(A, id), 409);
    view = await guess(A, id, 8); // agent de B : trouvé
    expect(view.cards[8]?.found).toBe(true);
    view = await guess(B, id, 24); // témoin de A, jamais touché sur sa carte : perdu
    expect(view.status).toBe("lost");
  });

  it("deux coups envoyés en même temps : un seul passe", async () => {
    const id = await newGame();
    await clue(A, id);
    const results = await Promise.allSettled([guess(B, id, 0), guess(B, id, 1)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const view = await getGame({ userId: B, gameId: id });
    expect(view.agentsLeft).toBe(14);
  });

  it("abandon : la partie s'arrête et ne compte pas au classement", async () => {
    const id = await newGame();
    const view = await playMove({ userId: B, gameId: id, move: { action: "abandon" } });
    expect(view.status).toBe("abandoned");
    expect((await duoLeaderboard(A, "all")).duos).toHaveLength(0);
    // une nouvelle partie peut alors être lancée
    expect((await createGame({ userId: A, partnerId: B })).created).toBe(true);
  });

  it("liste mes parties, celles où c'est à moi de jouer en premier", async () => {
    const id = await newGame();
    const other = (await createGame({ userId: C, partnerId: A })).id;
    await db.agentsGame.update({ where: { id: other }, data: { clueSeat: 0 } });
    const games = await listGames(A);
    expect(games.map((g) => [g.id, g.myTurn])).toEqual([
      [id, true],
      [other, false],
    ]);
    expect(games[0]?.partner.name).toBe(B);
  });
});
