// Answer checking and round building for the exercise pages. Type-only imports
// so Node can load it in tests.
import type { ExerciseItem } from "./types.ts";

export const ROUND_SIZE = 10;

export function normalise(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function isCorrect(item: ExerciseItem, answer: string): boolean {
  if (item.type === "choice") return answer === item.answer;
  return item.answers.map(normalise).includes(normalise(answer));
}

export function correctAnswer(item: ExerciseItem): string {
  return item.type === "choice" ? item.answer : item.answers[0];
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(xs: T[], rand: () => number = Math.random): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeRound(items: ExerciseItem[], size = ROUND_SIZE, rand: () => number = Math.random): ExerciseItem[] {
  return shuffle(items, rand).slice(0, size);
}
