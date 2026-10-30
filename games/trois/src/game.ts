// Constantes et types partagés client/serveur (aucune donnée secrète ici)
export const WORD_LEN = 5;
export const MAX_TRIES = 6;
export const WORDS_PER_DAY = 3;
/**
 * Délai de grâce après minuit : une journée commencée avant minuit (au moins un essai) et pas
 * finie reste jouable jusqu'à 00h30, tant que le joueur n'a pas commencé la nouvelle.
 */
export const GRACE_MINUTES = 30;
export const GRACE_MS = GRACE_MINUTES * 60_000;

export type Mark = "correct" | "present" | "absent";
export type WordStatus = "playing" | "won" | "lost";

export type WordView = {
  status: WordStatus;
  tries: number;
  marks: Mark[][];
  guesses?: string[];
  answer?: string;
};
export type DayView = {
  date: string;
  number: number;
  maxTries: number;
  over: boolean;
  /** Minuit qui termine la journée, à Paris (ms depuis l'epoch), délai de grâce non compris. */
  endsAt: number;
  words: WordView[];
};

/** Date AAAA-MM-JJ décalée de `days` jours. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const EPOCH = Date.UTC(2026, 0, 1);

/** Numéro de la journée (TROIS #1 = 1er janvier 2026). */
export function dayNumber(date: string): number {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

/** Premier jour de la période (lundi pour la semaine, le 1er pour le mois). */
export function periodStart(date: string, period: "week" | "month"): string {
  if (period === "month") return date.slice(0, 8) + "01";
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Une journée est commencée dès son premier essai. */
export const dayStarted = (d: DayView) => d.words.some((w) => w.tries > 0);

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z]/g, "");
}

const EMOJI: Record<Mark, string> = { correct: "🟩", present: "🟧", absent: "⬛" };

export function shareText(day: DayView, url = "") {
  const head = day.words
    .map((w) => (w.status === "won" ? w.tries : "X") + "/" + day.maxTries)
    .join(" · ");
  const grids = day.words.map(
    (w, i) => `Mot ${i + 1}\n` + w.marks.map((r) => r.map((m) => EMOJI[m]).join("")).join("\n"),
  );
  return `TROIS #${day.number} — ${head}\n\n${grids.join("\n\n")}${url ? "\n\n" + url : ""}`;
}

/** Classement du jour : ceux qui ont commencé d'abord, puis mots trouvés, puis le moins d'essais au total. */
export function dayScore(d: DayView) {
  const found = d.words.filter((w) => w.status === "won").length;
  const tries = d.words.reduce((s, w) => s + w.tries, 0);
  return { found, tries, started: tries > 0 };
}

export function compareDays(a: DayView, b: DayView) {
  const A = dayScore(a);
  const B = dayScore(b);
  return Number(B.started) - Number(A.started) || B.found - A.found || A.tries - B.tries;
}

export type Period = "day" | "week" | "month";

/** Points d'un mot trouvé : 6 en 1 essai … 1 en 6 essais (0 si raté). */
export const wordPoints = (tries: number) => MAX_TRIES + 1 - tries;
