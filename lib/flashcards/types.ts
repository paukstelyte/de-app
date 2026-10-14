import type { Level } from "../grammar/topics";

export type { Level };
export type Article = "der" | "die" | "das";

export const ARTICLES: Article[] = ["der", "die", "das"];

/** A built-in card (from `data/seed.json`) plus this browser's guest streak. */
export interface Flashcard {
  id: string;
  noun: string;
  article: Article;
  ruleId: string;
  level: Level;
  exception: string;
  incorrectStreak: number;
}

const STREAK_TO_CLASSIFY = 2;

export function needsPractice(card: Flashcard): boolean {
  return card.incorrectStreak >= STREAK_TO_CLASSIFY;
}
