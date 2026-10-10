import { shuffle } from "@/lib/exercises/check";
import { getFlashcardStatus, type Flashcard } from "./types";

export const ROUND_SIZE = 30;

/** Needs-practice cards first, then the rest of the deck — each group
 * shuffled — trimmed down to one round's worth of cards. A logged-in user's
 * saved trouble words (`priorityIds`) replace this browser's guest streaks
 * as the "needs practice" group. */
export function buildPracticeOrder(cards: Flashcard[], priorityIds?: string[]): string[] {
  const priority = priorityIds && new Set(priorityIds);
  const needsPractice = (c: Flashcard) =>
    priority ? priority.has(c.id) : getFlashcardStatus(c) === "needs-practice";
  return [...shuffle(cards.filter(needsPractice)), ...shuffle(cards.filter((c) => !needsPractice(c)))]
    .slice(0, ROUND_SIZE)
    .map((c) => c.id);
}
