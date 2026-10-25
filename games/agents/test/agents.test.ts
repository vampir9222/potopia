import { countUnread, listNotifications, listRecentEvents } from "@app/core";
import { db } from "@app/db";
import { truncateTestDb } from "@app/db/testing";
import { beforeEach, describe, expect, it } from "vitest";
import words from "../data/words.json";
import { normalize, SUDDEN_TURN, type GameView } from "../src/game";
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

async function expectAgentsError(
  promise: Promise<unknown>,
  status: number,
  message?: string | RegExp,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AgentsError);
  await expect(promise).rejects.toMatchObject({ status });
  if (message) await expect(promise).rejects.toThrow(message);
}

/** Titre de la dernière notification reçue par `userId`. */
async function lastNotification(userId: string): Promise<string | undefined> {
  return (await listNotifications(userId, 1))[0]?.title;
}

/**
 * Les 9 tours finis chacun sur un témoin commun, sans aucun agent trouvé : A donne les indices aux
 * tours impairs (témoins 18 à 22 révélés sur sa carte), B aux tours pairs (18 à 21 sur la sienne).
 */
async function toSuddenDeath(id: string): Promise<void> {
  for (let t = 0; t < 9; t++) {
    const giver = t % 2 === 0 ? A : B;
    const guesser = giver === A ? B : A;
    await clue(giver, id);
    await guess(guesser, id, 18 + Math.floor(t / 2));
  }
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
    await toSuddenDeath(id);
    let view = await getGame({ userId: A, gameId: id });
    expect(view).toMatchObject({ phase: "sudden", role: "sudden", turnsLeft: 0, mistakes: 9 });
    expect(await lastNotification(A)).toMatch(/mort subite/);
    await expectAgentsError(clue(A, id), 409);
    // déjà révélé témoin sur la carte du partenaire : on ne peut pas le retoucher
    await expectAgentsError(guess(A, id, 18), 409, /déjà un témoin/);
    await expectAgentsError(guess(B, id, 22), 409, /déjà un témoin/);
    view = await guess(A, id, 8); // agent de B : trouvé
    expect(view.cards[8]?.found).toBe(true);
    view = await guess(B, id, 24); // témoin de A, jamais touché sur sa carte : perdu
    expect(view.status).toBe("lost");
    expect(view.history.at(-1)).toMatchObject({
      turn: SUDDEN_TURN,
      guesses: [
        { seat: 0, card: 8, result: "agent" },
        { seat: 1, card: 24, result: "bystander" },
      ],
    });
  });

  it("victoire en mort subite : 10 tours, classée « mort subite », notification", async () => {
    const id = await newGame();
    await toSuddenDeath(id);
    for (const card of [0, 1, 2, 8, 9, 10, 11, 12]) await guess(A, id, card);
    for (const card of [3, 4, 5, 6, 7, 13]) await guess(B, id, card);
    const view = await guess(A, id, 14);
    expect(view).toMatchObject({ status: "won", turnsUsed: SUDDEN_TURN, agentsLeft: 0 });
    expect(await lastNotification(B)).toMatch(/réussie en mort subite/);
    const { duos } = await duoLeaderboard(A, "all");
    expect(duos[0]?.best).toEqual({ turns: SUDDEN_TURN, mistakes: 9 });
    const [event] = await listRecentEvents(1);
    expect(event?.payload).toMatchObject({ won: true, turns: SUDDEN_TURN });
  });

  it("mort subite : celui qui a tout trouvé ne touche plus, l'autre finit", async () => {
    const id = await newGame();
    // tour 1 : B trouve les 9 agents de A ; la main passe à B et n'en bouge plus
    await clue(A, id);
    for (const card of [0, 1, 2, 3, 4, 5, 6, 7, 13]) await guess(B, id, card);
    for (const card of [16, 18, 19, 20, 21, 22, 23, 24]) {
      await clue(B, id);
      await guess(A, id, card);
    }
    const viewB = await getGame({ userId: B, gameId: id });
    expect(viewB).toMatchObject({ phase: "sudden", role: "wait", partnerAgentsLeft: 0 });
    expect(await getGame({ userId: A, gameId: id })).toMatchObject({
      role: "sudden",
      partnerAgentsLeft: 6,
    });
    await expectAgentsError(guess(B, id, 8), 409, /déjà trouvé tous les agents/);
    expect((await listGames(B))[0]?.myTurn).toBe(false);
    expect((await listGames(A))[0]?.myTurn).toBe(true);
    const view = await guess(A, id, 8);
    expect(view.cards[8]?.found).toBe(true);
  });

  it("la main reste au même donneur tant que l'autre n'a plus d'agents à faire trouver", async () => {
    const id = await newGame();
    await clue(A, id);
    for (const card of [0, 1, 2, 3, 4, 5, 6, 7]) await guess(B, id, card);
    let view = await guess(B, id, 13); // dernier agent de A : fin de tour automatique
    expect(view).toMatchObject({ phase: "clue", clueSeat: 1, turnsLeft: 8 });
    // témoin : le tour s'arrête, B redonne l'indice puisque A n'a plus rien à faire trouver
    await clue(B, id);
    view = await guess(A, id, 18);
    expect(view).toMatchObject({ phase: "clue", clueSeat: 1, turnsLeft: 7, mistakes: 1 });
    // stop : pareil, et B est prévenu que c'est encore à lui
    const before = await countUnread(B);
    await clue(B, id);
    await guess(A, id, 8);
    view = await stop(A, id);
    expect(view).toMatchObject({ phase: "clue", clueSeat: 1, turnsLeft: 6, role: "wait" });
    expect(await countUnread(B)).toBe(before + 1);
    expect(await lastNotification(B)).toMatch(/à toi de donner un indice/);
  });

  it("agent commun qui vide la carte du toucheur : la main ne lui revient pas", async () => {
    const id = await newGame();
    await clue(A, id);
    await guess(B, id, 3);
    await stop(B, id);
    await clue(B, id);
    for (const card of [8, 9, 10, 11, 12, 14]) await guess(A, id, card); // agents propres de B
    await stop(A, id);
    await clue(A, id);
    await guess(B, id, 0);
    await guess(B, id, 1);
    // dernier agent de B (commun) : A en a encore, B continue à chercher
    let view = await guess(B, id, 2);
    expect(view).toMatchObject({ phase: "guess", clueSeat: 0, myAgentsLeft: 0, turnGuesses: 3 });
    view = await stop(B, id);
    expect(view).toMatchObject({ phase: "clue", clueSeat: 0, role: "wait", turnsLeft: 6 });
  });

  it("stop : le partenaire n'est prévenu que si la main change de camp", async () => {
    const id = await newGame();
    await clue(A, id);
    await guess(B, id, 0);
    const before = await countUnread(A);
    // B s'arrête et c'est à lui de donner l'indice : A n'a rien à faire, pas de notification
    const view = await stop(B, id);
    expect(view).toMatchObject({ phase: "clue", clueSeat: 1, role: "clue" });
    expect(await countUnread(A)).toBe(before);
  });

  it("deux indices envoyés en même temps : un seul passe, aucune ligne orpheline", async () => {
    const id = await newGame();
    const results = await Promise.allSettled([clue(A, id, "un"), clue(A, id, "deux")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.agentsClue.count({ where: { gameId: id } })).toBe(1);
    const view = await getGame({ userId: B, gameId: id });
    expect(view.history).toHaveLength(1);
    expect(view).toMatchObject({ phase: "guess", version: 1 });
  });

  it("abandonner une partie finie : 409, et un coup mal formé : 400", async () => {
    const id = await newGame();
    await playMove({ userId: B, gameId: id, move: { action: "abandon" } });
    await expectAgentsError(playMove({ userId: A, gameId: id, move: { action: "abandon" } }), 409);
    const other = await newGame();
    await expectAgentsError(
      playMove({ userId: A, gameId: other, move: { action: "guess", card: "3" } }),
      400,
      "Requête invalide",
    );
    await expectAgentsError(playMove({ userId: A, gameId: other, move: {} }), 400);
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
    expect(games.map((g) => g.agentsLeft)).toEqual([15, 15]);
  });

  it("liste mes parties : les finies après les en cours, même plus récentes", async () => {
    const withB = await newGame();
    const withC = (await createGame({ userId: C, partnerId: A })).id;
    await clue(A, withB);
    await guess(B, withB, 0);
    await playMove({ userId: B, gameId: withB, move: { action: "abandon" } });
    const games = await listGames(A);
    expect(games.map((g) => [g.id, g.status, g.agentsLeft])).toEqual([
      [withC, "playing", 15],
      [withB, "abandoned", 14],
    ]);
  });

  it("deux invitations en même temps : une seule partie en cours", async () => {
    // L'invitation de B est encore en transaction (ligne insérée, pas validée) : celle de A ne la
    // voit pas, son insertion attend la validation puis échoue sur l'index unique, et A rejoint
    // la partie de B.
    let inserted!: () => void;
    let release!: () => void;
    const onceInserted = new Promise<void>((r) => (inserted = r));
    const released = new Promise<void>((r) => (release = r));
    const holder = db.$transaction(async (tx) => {
      const g = await tx.agentsGame.create({
        data: { userA: B, userB: A, words: [], keyA: KEY_B, keyB: KEY_A, clueSeat: 0 },
      });
      inserted();
      await released;
      return g.id;
    });
    await onceInserted;
    const pending = createGame({ userId: A, partnerId: B });
    await new Promise((r) => setTimeout(r, 300));
    release();
    const [firstId, second] = await Promise.all([holder, pending]);
    expect(second).toEqual({ id: firstId, created: false });
    expect(await db.agentsGame.count({ where: { status: "PLAYING" } })).toBe(1);
    // l'invitation perdante a été annulée avec sa partie
    expect(await countUnread(B)).toBe(0);
    await expectAgentsError(createGame({ userId: A, partnerId: 3 }), 400);
  });
});
