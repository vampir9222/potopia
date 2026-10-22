import { WORD_LEN, type Mark } from "./game";

/** Feedback lettre par lettre (gère correctement les lettres en double). */
export function evaluate(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array<Mark>(WORD_LEN).fill("absent");
  const left: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    const a = answer.charAt(i);
    if (guess.charAt(i) === a) marks[i] = "correct";
    else left[a] = (left[a] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    const g = guess.charAt(i);
    if (marks[i] !== "correct" && left[g]) {
      marks[i] = "present";
      left[g] = left[g] - 1;
    }
  }
  return marks;
}
