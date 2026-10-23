import { WORD_LEN, type Mark } from "./game";

/**
 * Feedback lettre par lettre. Une lettre en double est signalée à chaque occurrence : verte à sa
 * place, orange ailleurs dès que la réponse la contient (NONNE contre NOIRS : N vert, N, N orange).
 */
export function evaluate(guess: string, answer: string): Mark[] {
  const marks: Mark[] = [];
  for (let i = 0; i < WORD_LEN; i++) {
    const g = guess.charAt(i);
    marks.push(g === answer.charAt(i) ? "correct" : answer.includes(g) ? "present" : "absent");
  }
  return marks;
}
