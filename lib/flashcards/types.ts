export type Article = "der" | "die" | "das";

export const ARTICLES: Article[] = ["der", "die", "das"];

export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

export type FlashcardStatus = "needs-practice" | "unplayed";

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

export const STREAK_TO_CLASSIFY = 2;

export function getFlashcardStatus(card: Flashcard): FlashcardStatus {
  return card.incorrectStreak >= STREAK_TO_CLASSIFY ? "needs-practice" : "unplayed";
}
