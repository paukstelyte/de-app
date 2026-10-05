import type { Flashcard } from "./types";
import seedCards from "./data/seed.json";
import rules from "./data/rules.json";

const STORAGE_KEY = "de-app:streaks";

type SeedCard = Omit<Flashcard, "incorrectStreak">;
type Streaks = Record<string, number>;

export const RULE_TEXT_BY_ID = new Map(rules.map((r) => [r.id, r.description]));

/** The built-in deck merged with this browser's saved wrong-answer streaks.
 * Only the streaks are stored — the cards themselves always come from seed.json. */
export function loadFlashcards(): Flashcard[] {
  let streaks: Streaks = {};
  if (typeof window !== "undefined") {
    try {
      streaks = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      // Corrupt or blocked storage: start with no streaks.
    }
  }
  return (seedCards as SeedCard[]).map((card) => ({
    ...card,
    incorrectStreak: streaks[card.id] ?? 0,
  }));
}

export function saveFlashcards(cards: Flashcard[]): void {
  if (typeof window === "undefined") return;
  const streaks: Streaks = {};
  for (const card of cards) if (card.incorrectStreak) streaks[card.id] = card.incorrectStreak;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(streaks));
  } catch {
    // Storage may be full or blocked (e.g. private browsing); the
    // app still works for the rest of this session.
  }
}
