// Règles de Codenames Duet, sans base de données : tirage des cartes et effet de chaque coup.
import { AgentsError } from "./errors";
import { GRID, MAX_COUNT, normalize, TURNS, type Cell, type Phase, type Seat } from "./game";

/** Tirage au hasard dans [0, n[ (crypto côté serveur, prévisible dans les tests). */
export type Rand = (n: number) => number;

/**
 * Répartition des 25 cases entre les deux cartes, comme la carte-clé recto verso du jeu :
 * 3 agents communs, 5 + 5 agents propres à chacun, 1 agent de l'un assassin de l'autre (×2),
 * 1 assassin commun, 1 assassin de l'un témoin de l'autre (×2), 7 témoins communs.
 */
const PAIRS: [Cell, Cell, number][] = [
  ["G", "G", 3],
  ["G", "N", 5],
  ["N", "G", 5],
  ["G", "A", 1],
  ["A", "G", 1],
  ["A", "A", 1],
  ["A", "N", 1],
  ["N", "A", 1],
  ["N", "N", 7],
];

function shuffle<T>(items: T[], rand: Rand): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    const x = a[i] as T;
    a[i] = a[j] as T;
    a[j] = x;
  }
  return a;
}

/** Les deux cartes secrètes, en chaînes de 25 caractères (G, N, A). */
export function dealKeys(rand: Rand): [string, string] {
  const cells = shuffle(
    PAIRS.flatMap(([a, b, n]) => Array.from({ length: n }, () => [a, b] as const)),
    rand,
  );
  return [cells.map((c) => c[0]).join(""), cells.map((c) => c[1]).join("")];
}

const tokens = (word: string) => normalize(word).split(" ").filter(Boolean);

/** Même mot, ou l'un est l'autre avec une terminaison de 1 ou 2 lettres (chat / chats). */
function sameStem(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && long.length - short.length <= 2 && short.length >= 3;
}

function related(a: string, b: string): boolean {
  if (normalize(a) === normalize(b)) return true;
  return tokens(a).some((x) => tokens(b).some((y) => x === y || sameStem(x, y)));
}

/** 25 mots au hasard, sans deux mots trop proches sur la même grille (lapin / Lapins Crétins). */
export function drawWords(pool: readonly string[], rand: Rand): string[] {
  const picked: string[] = [];
  for (const word of shuffle([...pool], rand)) {
    if (!picked.some((p) => related(p, word))) picked.push(word);
    if (picked.length === GRID) return picked;
  }
  throw new Error("Liste de mots trop courte pour une grille");
}

/** Indice valide : un seul mot, qui n'est pas (presque) un des mots encore visibles. */
export function checkClue(input: unknown, visible: readonly string[]): string {
  const word = String(input ?? "").trim();
  if (!word) throw new AgentsError(400, "Il faut un indice");
  if (word.length > 30) throw new AgentsError(400, "Indice trop long");
  if (/\s/.test(word)) throw new AgentsError(400, "Un seul mot par indice");
  if (!/^[\p{L}\p{N}'-]+$/u.test(word)) throw new AgentsError(400, "Lettres uniquement");
  if (visible.some((v) => related(v, word))) {
    throw new AgentsError(400, "Ton indice ressemble trop à un mot de la grille");
  }
  return word;
}

export function checkCount(input: unknown): number {
  const count = Number(input);
  if (!Number.isInteger(count) || count < 0 || count > MAX_COUNT) {
    throw new AgentsError(400, `Nombre de 0 à ${MAX_COUNT}`);
  }
  return count;
}

export type Board = {
  keys: [string, string];
  found: boolean[];
  /** bystander[s][i] : le mot i est révélé témoin sur la carte du siège s. */
  bystander: [boolean[], boolean[]];
};

export type Turn = {
  status: "playing" | "won" | "lost";
  phase: Phase;
  clueSeat: Seat;
  turnsLeft: number;
  turnGuesses: number;
  mistakes: number;
};

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
export const cell = (board: Board, seat: Seat, card: number) =>
  board.keys[seat].charAt(card) as Cell;

/** Agents de la carte de `seat` pas encore trouvés (c'est l'autre joueur qui doit les trouver). */
export function agentsLeftOf(board: Board, seat: Seat): number {
  let n = 0;
  for (let i = 0; i < GRID; i++) if (cell(board, seat, i) === "G" && !board.found[i]) n++;
  return n;
}

export function agentsLeft(board: Board): number {
  let n = 0;
  for (let i = 0; i < GRID; i++) {
    if (!board.found[i] && (cell(board, 0, i) === "G" || cell(board, 1, i) === "G")) n++;
  }
  return n;
}

/** Fin du tour : un jeton de moins, puis l'autre joueur donne l'indice (s'il lui reste des agents). */
function endTurn(turn: Turn, board: Board): Turn {
  const turnsLeft = turn.turnsLeft - 1;
  if (turnsLeft === 0) return { ...turn, turnsLeft, turnGuesses: 0, phase: "sudden" };
  const next = other(turn.clueSeat);
  const clueSeat = agentsLeftOf(board, next) > 0 ? next : turn.clueSeat;
  return { ...turn, turnsLeft, turnGuesses: 0, phase: "clue", clueSeat };
}

/** Tours utilisés : indices donnés, ou SUDDEN_TURN pour une victoire en mort subite. */
export function turnsUsed(turn: Turn): number {
  return turn.phase === "sudden" ? TURNS + 1 : TURNS - turn.turnsLeft + 1;
}

export function applyClue(turn: Turn, board: Board, seat: Seat): Turn {
  if (turn.status !== "playing") throw new AgentsError(409, "La partie est terminée");
  if (turn.phase !== "clue" || turn.clueSeat !== seat) {
    throw new AgentsError(409, "Ce n'est pas à toi de donner l'indice");
  }
  // garde-fou : `endTurn` ne donne jamais la main à un joueur sans agent à faire trouver
  if (agentsLeftOf(board, seat) === 0) {
    throw new AgentsError(409, "Tu n'as plus d'agents à faire trouver");
  }
  return { ...turn, phase: "guess", turnGuesses: 0 };
}

/** En mort subite, seul un joueur à qui il reste des agents du partenaire à trouver peut toucher. */
export function canTouchSudden(board: Board, seat: Seat): boolean {
  return agentsLeftOf(board, other(seat)) > 0;
}

/**
 * Un mot touché. Pendant un tour, il est jugé sur la carte de celui qui a donné l'indice ;
 * en mort subite, sur la carte du partenaire de celui qui touche, et tout sauf un agent fait perdre.
 * Un joueur qui a déjà trouvé tous les agents de son partenaire ne touche plus : il ne lui
 * resterait que des témoins et des assassins, donc une défaite assurée.
 */
export function applyGuess(
  turn: Turn,
  board: Board,
  seat: Seat,
  card: number,
): { turn: Turn; board: Board; result: Cell; ended: "won" | "lost" | null; turnsUsed: number } {
  if (turn.status !== "playing") throw new AgentsError(409, "La partie est terminée");
  if (!Number.isInteger(card) || card < 0 || card >= GRID)
    throw new AgentsError(400, "Mot inconnu");
  const sudden = turn.phase === "sudden";
  if (!sudden && (turn.phase !== "guess" || other(turn.clueSeat) !== seat)) {
    throw new AgentsError(409, "Ce n'est pas à toi de toucher un mot");
  }
  if (sudden && !canTouchSudden(board, seat)) {
    throw new AgentsError(
      409,
      "Tu as déjà trouvé tous les agents de ton partenaire : c'est à lui de toucher",
    );
  }
  const giver = other(seat);
  if (board.found[card]) throw new AgentsError(409, "Cet agent est déjà trouvé");
  if (board.bystander[giver][card]) {
    throw new AgentsError(409, "Ce mot est déjà un témoin sur la carte de ton partenaire");
  }

  const result = cell(board, giver, card);
  const used = turnsUsed(turn);
  const found = [...board.found];
  const bystander: Board["bystander"] = [[...board.bystander[0]], [...board.bystander[1]]];
  const next: Board = { keys: board.keys, found, bystander };

  if (result === "A" || (sudden && result === "N")) {
    return {
      turn: { ...turn, status: "lost", phase: "over" },
      board: next,
      result,
      ended: "lost",
      turnsUsed: used,
    };
  }
  if (result === "N") {
    bystander[giver][card] = true;
    const t = endTurn({ ...turn, mistakes: turn.mistakes + 1 }, next);
    return { turn: t, board: next, result, ended: null, turnsUsed: used };
  }

  found[card] = true;
  if (agentsLeft(next) === 0) {
    return {
      turn: { ...turn, status: "won", phase: "over", turnGuesses: turn.turnGuesses + 1 },
      board: next,
      result,
      ended: "won",
      turnsUsed: used,
    };
  }
  let t: Turn = { ...turn, turnGuesses: turn.turnGuesses + 1 };
  // plus aucun agent sur la carte de celui qui a donné l'indice : rien d'autre à trouver ce tour-ci
  if (!sudden && agentsLeftOf(next, giver) === 0) t = endTurn(t, next);
  return { turn: t, board: next, result, ended: null, turnsUsed: used };
}

/** Celui qui touche s'arrête volontairement, après au moins un mot. */
export function applyStop(turn: Turn, board: Board, seat: Seat): Turn {
  if (turn.status !== "playing") throw new AgentsError(409, "La partie est terminée");
  if (turn.phase !== "guess" || other(turn.clueSeat) !== seat) {
    throw new AgentsError(409, "Ce n'est pas à toi de jouer");
  }
  if (turn.turnGuesses === 0) throw new AgentsError(409, "Touche au moins un mot avant d'arrêter");
  return endTurn(turn, board);
}
