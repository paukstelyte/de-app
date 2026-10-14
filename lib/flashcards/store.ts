import { useSyncExternalStore } from "react";
import type { Flashcard } from "./types";
import { loadFlashcards, saveFlashcards } from "./storage";

type Listener = () => void;

let cards: Flashcard[] = [];
let hydrated = false;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Client snapshot: lazily hydrates from localStorage on first read. */
function getSnapshot(): Flashcard[] {
  if (!hydrated) {
    cards = loadFlashcards();
    hydrated = true;
  }
  return cards;
}

/** Server snapshot: localStorage doesn't exist during SSR, so render empty.
 * Must return the same reference every call, or useSyncExternalStore loops. */
const EMPTY_CARDS: Flashcard[] = [];
function getServerSnapshot(): Flashcard[] {
  return EMPTY_CARDS;
}

/** Updates a card's guest streak and saves the deck to localStorage. */
export function recordAnswer(id: string, wasCorrect: boolean): void {
  cards = getSnapshot().map((card) =>
    card.id === id ? { ...card, incorrectStreak: wasCorrect ? 0 : card.incorrectStreak + 1 } : card,
  );
  saveFlashcards(cards);
  listeners.forEach((listener) => listener());
}

/** The deck with this browser's guest streaks (browser components only). */
export function useFlashcards(): Flashcard[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
