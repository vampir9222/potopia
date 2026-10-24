import { randomInt } from "node:crypto";
import { getUser, getUsersByIds, listUsers, notify, publishEvent } from "@app/core";
import { db, Prisma, withTx, type DbTx } from "@app/db";
import { z } from "zod";
import words from "../data/words.json";
import { AgentsError } from "./errors";
import {
  GRID,
  NAME,
  SUDDEN_TURN,
  TURNS,
  type Cell,
  type GameView,
  type LobbyGame,
  type Phase,
  type Role,
  type Seat,
  type Status,
  type TurnView,
  type Who,
} from "./game";
import {
  agentsLeft,
  agentsLeftOf,
  applyClue,
  applyGuess,
  applyStop,
  cell,
  checkClue,
  checkCount,
  dealKeys,
  drawWords,
  other,
  type Board,
  type Rand,
  type Turn,
} from "./rules";

const POOL = words as string[];
const cryptoRand: Rand = (n) => randomInt(n);

const STATUS = {
  PLAYING: "playing",
  WON: "won",
  LOST: "lost",
  ABANDONED: "abandoned",
} as const satisfies Record<string, Status>;
const PHASE = { CLUE: "clue", GUESS: "guess", SUDDEN: "sudden", OVER: "over" } as const;
const TO_STATUS = {
  playing: "PLAYING",
  won: "WON",
  lost: "LOST",
  abandoned: "ABANDONED",
} as const satisfies Record<Status, string>;
const TO_PHASE = { clue: "CLUE", guess: "GUESS", sudden: "SUDDEN", over: "OVER" } as const;
const RESULT = { AGENT: "agent", BYSTANDER: "bystander", ASSASSIN: "assassin" } as const;
const TO_RESULT = { G: "AGENT", N: "BYSTANDER", A: "ASSASSIN" } as const;

const include = {
  clues: { orderBy: { turn: "asc" } },
  guesses: { orderBy: { seq: "asc" } },
} as const satisfies Prisma.AgentsGameInclude;
type GameRow = Prisma.AgentsGameGetPayload<{ include: typeof include }>;

async function loadGame(id: string, client: DbTx | typeof db = db): Promise<GameRow> {
  const game = await client.agentsGame.findUnique({ where: { id }, include });
  if (!game) throw new AgentsError(404, "Partie introuvable");
  return game;
}

/** Siège du joueur dans la partie, sinon 403 : on ne regarde pas la partie des autres. */
function seatOf(game: { userA: string; userB: string }, userId: string): Seat {
  if (game.userA === userId) return 0;
  if (game.userB === userId) return 1;
  throw new AgentsError(403, "Cette partie n'est pas la tienne");
}

/** État des cases rejoué à partir des mots touchés. */
function boardOf(game: GameRow): Board {
  const board: Board = {
    keys: [game.keyA, game.keyB],
    found: Array<boolean>(GRID).fill(false),
    bystander: [Array<boolean>(GRID).fill(false), Array<boolean>(GRID).fill(false)],
  };
  for (const g of game.guesses) {
    if (g.result === "AGENT") board.found[g.card] = true;
    // pendant un tour, un témoin est révélé sur la carte de celui qui a donné l'indice
    if (g.result === "BYSTANDER" && g.turn <= TURNS)
      board.bystander[other(g.seat as Seat)][g.card] = true;
  }
  return board;
}

function turnOf(game: GameRow): Turn {
  return {
    status: game.status === "WON" ? "won" : game.status === "PLAYING" ? "playing" : "lost",
    phase: PHASE[game.phase],
    clueSeat: game.clueSeat as Seat,
    turnsLeft: game.turnsLeft,
    turnGuesses: game.turnGuesses,
    mistakes: game.mistakes,
  };
}

function roleOf(phase: Phase, status: Status, clueSeat: Seat, seat: Seat): Role {
  if (status !== "playing") return "over";
  if (phase === "sudden") return "sudden";
  if (phase === "clue") return clueSeat === seat ? "clue" : "wait";
  return other(clueSeat) === seat ? "guess" : "wait";
}

function who(users: Map<string, Who>, id: string): Who {
  return users.get(id) ?? { id, name: "Membre inconnu", image: null };
}

async function identities(ids: string[]): Promise<Map<string, Who>> {
  const users = await getUsersByIds(ids);
  return new Map(users.map((u) => [u.id, { id: u.id, name: u.name, image: u.image }]));
}

/** La partie telle que `seat` a le droit de la voir : jamais la carte du partenaire avant la fin. */
function viewOf(game: GameRow, seat: Seat, users: Map<string, Who>): GameView {
  const board = boardOf(game);
  const status = STATUS[game.status];
  const phase = PHASE[game.phase];
  const partnerSeat = other(seat);
  const over = status !== "playing";

  const history: TurnView[] = game.clues.map((c) => ({
    turn: c.turn,
    clue: { seat: c.seat as Seat, word: c.word, count: c.count },
    guesses: [],
  }));
  for (const g of game.guesses) {
    let t = history.find((h) => h.turn === g.turn);
    if (!t) {
      t = { turn: g.turn, guesses: [] };
      history.push(t);
    }
    t.guesses.push({ seat: g.seat as Seat, card: g.card, result: RESULT[g.result] });
  }

  return {
    id: game.id,
    mySeat: seat,
    me: who(users, seat === 0 ? game.userA : game.userB),
    partner: who(users, seat === 0 ? game.userB : game.userA),
    cards: game.words.map((word, i) => ({
      word,
      mine: cell(board, seat, i),
      theirs: over ? cell(board, partnerSeat, i) : undefined,
      found: board.found[i] ?? false,
      bystanderMine: board.bystander[seat][i] ?? false,
      bystanderTheirs: board.bystander[partnerSeat][i] ?? false,
    })),
    status,
    phase,
    role: roleOf(phase, status, game.clueSeat as Seat, seat),
    clueSeat: game.clueSeat as Seat,
    turnsLeft: game.turnsLeft,
    turnGuesses: game.turnGuesses,
    mistakes: game.mistakes,
    turnsUsed: game.turnsUsed,
    agentsLeft: agentsLeft(board),
    myAgentsLeft: agentsLeftOf(board, seat),
    partnerAgentsLeft: agentsLeftOf(board, partnerSeat),
    history: history.sort((a, b) => a.turn - b.turn),
    version: game.version,
  };
}

/** Membres qu'on peut inviter (tout le monde sauf moi). */
export async function listPartners(userId: string): Promise<Who[]> {
  const users = await listUsers();
  return users
    .filter((u) => u.id !== userId)
    .map((u) => ({ id: u.id, name: u.name, image: u.image }));
}

/** Mes parties, en cours d'abord (celles où c'est à moi de jouer en tête), puis les dernières finies. */
export async function listGames(userId: string): Promise<LobbyGame[]> {
  const games = await db.agentsGame.findMany({
    where: { OR: [{ userA: userId }, { userB: userId }] },
    orderBy: { updatedAt: "desc" },
    take: 40,
    include,
  });
  const users = await identities(games.flatMap((g) => [g.userA, g.userB]));
  const rows = games.map((g) => {
    const seat = seatOf(g, userId);
    const role = roleOf(PHASE[g.phase], STATUS[g.status], g.clueSeat as Seat, seat);
    return {
      id: g.id,
      partner: who(users, seat === 0 ? g.userB : g.userA),
      status: STATUS[g.status],
      myTurn: role !== "wait" && role !== "over",
      turnsLeft: g.turnsLeft,
      agentsLeft: agentsLeft(boardOf(g)),
      turnsUsed: g.turnsUsed,
      updatedAt: g.updatedAt.toISOString(),
    };
  });
  const rank = (g: LobbyGame) => (g.status !== "playing" ? 2 : g.myTurn ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b));
}

export async function getGame(input: { userId: string; gameId: string }): Promise<GameView> {
  const game = await loadGame(input.gameId);
  const seat = seatOf(game, input.userId);
  return viewOf(game, seat, await identities([game.userA, game.userB]));
}

const createInput = z.object({ userId: z.string().min(1), partnerId: z.string().min(1) });

/**
 * Nouvelle partie avec un membre. Grille et cartes tirées côté serveur. S'il existe déjà une partie
 * en cours entre les deux, on la renvoie au lieu d'en créer une deuxième.
 */
export async function createGame(
  input: { userId: string; partnerId: unknown },
  opts?: { tx?: DbTx; rand?: Rand },
): Promise<{ id: string; created: boolean }> {
  const { userId, partnerId } = createInput.parse(input);
  if (partnerId === userId) throw new AgentsError(400, "Choisis un autre membre que toi");
  const partner = await getUser(partnerId);
  if (!partner) throw new AgentsError(404, "Membre introuvable");

  const client = opts?.tx ?? db;
  const running = await client.agentsGame.findFirst({
    where: {
      status: "PLAYING",
      OR: [
        { userA: userId, userB: partnerId },
        { userA: partnerId, userB: userId },
      ],
    },
    select: { id: true },
  });
  if (running) return { id: running.id, created: false };

  const rand = opts?.rand ?? cryptoRand;
  const [keyA, keyB] = dealKeys(rand);
  const me = await getUser(userId);
  const id = await withTx(async (tx) => {
    const game = await tx.agentsGame.create({
      data: {
        userA: userId,
        userB: partnerId,
        words: drawWords(POOL, rand),
        keyA,
        keyB,
        clueSeat: rand(2),
      },
    });
    await notify(
      {
        userId: partnerId,
        title: `${me?.name ?? "Un membre"} t'invite à une mission ${NAME}`,
        link: `/agents/${game.id}`,
      },
      { tx },
    );
    return game.id;
  }, opts);
  return { id, created: true };
}

export const moveInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clue"), word: z.unknown(), count: z.unknown() }),
  z.object({ action: z.literal("guess"), card: z.number() }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("abandon") }),
]);
export type Move = z.infer<typeof moveInput>;

/**
 * Un coup dans une partie : indice, mot touché, fin du tour ou abandon. Le serveur applique les
 * règles et enregistre ; `version` empêche deux coups simultanés de passer tous les deux.
 */
export async function playMove(
  input: { userId: string; gameId: string; move: unknown },
  opts?: { tx?: DbTx },
): Promise<GameView> {
  const move = moveInput.parse(input.move);
  const game = await loadGame(input.gameId);
  const seat = seatOf(game, input.userId);
  const partnerId = seat === 0 ? game.userB : game.userA;
  const board = boardOf(game);
  const turn = turnOf(game);

  try {
    await withTx(async (tx) => {
      const update = async (
        next: Turn,
        extra: { status?: Status; turnsUsed?: number } = {},
      ): Promise<void> => {
        const finished = extra.status && extra.status !== "playing";
        const { count } = await tx.agentsGame.updateMany({
          where: { id: game.id, version: game.version },
          data: {
            phase: TO_PHASE[next.phase],
            clueSeat: next.clueSeat,
            turnsLeft: next.turnsLeft,
            turnGuesses: next.turnGuesses,
            mistakes: next.mistakes,
            version: { increment: 1 },
            ...(extra.status ? { status: TO_STATUS[extra.status] } : {}),
            ...(extra.turnsUsed !== undefined ? { turnsUsed: extra.turnsUsed } : {}),
            ...(finished ? { finishedAt: new Date() } : {}),
          },
        });
        if (count === 0) throw new AgentsError(409, "La partie a bougé, recharge la page");
      };
      const tell = (title: string) =>
        notify({ userId: partnerId, title, link: `/agents/${game.id}` }, { tx });

      if (move.action === "abandon") {
        if (turn.status !== "playing") throw new AgentsError(409, "La partie est terminée");
        await update({ ...turn, phase: "over" }, { status: "abandoned" });
        await tell(`${NAME} : ton partenaire a abandonné la mission`);
        return;
      }

      if (move.action === "clue") {
        const visible = game.words.filter((_, i) => !board.found[i]);
        const word = checkClue(move.word, visible);
        const count = checkCount(move.count);
        const next = applyClue(turn, seat);
        await tx.agentsClue.create({
          data: { gameId: game.id, turn: TURNS - turn.turnsLeft + 1, seat, word, count },
        });
        await update(next);
        await tell(`${NAME} : nouvel indice, à toi de trouver les agents`);
        return;
      }

      if (move.action === "stop") {
        const next = applyStop(turn, board, seat);
        await update(next);
        if (next.phase === "sudden") await tell(`${NAME} : mort subite, plus aucun indice`);
        else if (next.clueSeat !== seat) await tell(`${NAME} : à toi de donner un indice`);
        return;
      }

      const r = applyGuess(turn, board, seat, move.card);
      await tx.agentsGuess.create({
        data: {
          gameId: game.id,
          seq: game.guesses.length + 1,
          turn: turn.phase === "sudden" ? SUDDEN_TURN : TURNS - turn.turnsLeft + 1,
          seat,
          card: move.card,
          result: TO_RESULT[r.result as Cell],
        },
      });
      if (r.ended) {
        await update(r.turn, { status: r.ended, turnsUsed: r.turnsUsed });
        await tell(
          r.ended === "won"
            ? `${NAME} : mission réussie en ${r.turnsUsed} tours !`
            : `${NAME} : mission échouée`,
        );
        await publishEvent(
          {
            userId: input.userId,
            app: "agents",
            type: "mission_completed",
            payload: { partnerId, won: r.ended === "won", turns: r.turnsUsed },
          },
          { tx },
        );
        return;
      }
      await update(r.turn);
      if (r.turn.phase === "sudden" && turn.phase !== "sudden") {
        await tell(`${NAME} : mort subite, plus aucun indice`);
      } else if (r.turn.phase === "clue" && r.turn.clueSeat !== seat) {
        // tour fini et je n'ai plus d'agents à faire trouver : mon partenaire redonne l'indice
        await tell(`${NAME} : à toi de donner un indice`);
      }
    }, opts);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AgentsError(409, "La partie a bougé, recharge la page");
    }
    throw error;
  }

  const after = await loadGame(game.id);
  return viewOf(after, seat, await identities([after.userA, after.userB]));
}
