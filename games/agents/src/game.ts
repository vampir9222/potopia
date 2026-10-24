// Constantes et types partagés client/serveur (aucune donnée secrète ici)
export const NAME = "Agents Doubles";
export const GRID = 25;
export const TURNS = 9;
/** Agents à trouver en tout : 9 par carte, dont 3 en commun. */
export const AGENTS_TOTAL = 15;
export const MAX_COUNT = 9;
/** Tour noté pour une partie gagnée en mort subite (après les 9 tours). */
export const SUDDEN_TURN = TURNS + 1;

export type Seat = 0 | 1;
/** Case d'une carte secrète : G = agent, N = témoin, A = assassin. */
export type Cell = "G" | "N" | "A";
export type Status = "playing" | "won" | "lost" | "abandoned";
export type Phase = "clue" | "guess" | "sudden" | "over";
export type Result = "agent" | "bystander" | "assassin";

export type Who = { id: string; name: string; image: string | null };

export type CardView = {
  word: string;
  /** Ma carte : ce que ce mot est pour moi. */
  mine: Cell;
  /** Carte du partenaire, seulement une fois la partie finie. */
  theirs?: Cell;
  found: boolean;
  /** Témoin sur MA carte : mon partenaire l'a touché sur un de mes indices. */
  bystanderMine: boolean;
  /** Témoin sur la carte du partenaire : je l'ai touché sur un de ses indices. */
  bystanderTheirs: boolean;
};

export type GuessView = { seat: Seat; card: number; result: Result };
export type TurnView = {
  /** 1 à 9, ou SUDDEN_TURN pour la mort subite */
  turn: number;
  clue?: { seat: Seat; word: string; count: number };
  guesses: GuessView[];
};

/** Ce que je dois faire maintenant. */
export type Role = "clue" | "guess" | "sudden" | "wait" | "over";

export type GameView = {
  id: string;
  mySeat: Seat;
  me: Who;
  partner: Who;
  cards: CardView[];
  status: Status;
  phase: Phase;
  role: Role;
  clueSeat: Seat;
  turnsLeft: number;
  turnGuesses: number;
  mistakes: number;
  turnsUsed: number | null;
  /** Agents encore à trouver, en tout. */
  agentsLeft: number;
  /** Mes agents que le partenaire doit encore trouver. */
  myAgentsLeft: number;
  /** Agents du partenaire que je dois encore trouver. */
  partnerAgentsLeft: number;
  history: TurnView[];
  version: number;
};

export type LobbyGame = {
  id: string;
  partner: Who;
  status: Status;
  myTurn: boolean;
  turnsLeft: number;
  agentsLeft: number;
  turnsUsed: number | null;
  updatedAt: string;
};

export type Period = "month" | "all";

export type Duo = {
  players: [Who, Who];
  me: boolean;
  played: number;
  wins: number;
  /** Meilleure victoire : tours utilisés puis témoins touchés. */
  best: { turns: number; mistakes: number } | null;
};

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
