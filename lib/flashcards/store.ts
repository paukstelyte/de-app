import type { Flashcard } from "./types";
import { loadFlashcards, saveFlashcards } from "./storage";

type Listener = () => void;

let cards: Flashcard[] = [];
let hydrated = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Client snapshot: lazily hydrates from localStorage on first read. */
export function getSnapshot(): Flashcard[] {
  if (!hydrated) {
    cards = loadFlashcards();
    hydrated = true;
  }
  return cards;
}

/** Server snapshot: localStorage doesn't exist during SSR, so render empty.
 * Must return the same reference every call, or useSyncExternalStore loops. */
const EMPTY_CARDS: Flashcard[] = [];
export function getServerSnapshot(): Flashcard[] {
  return EMPTY_CARDS;
}

export function setCards(
  next: Flashcard[] | ((prev: Flashcard[]) => Flashcard[]),
): void {
  cards = typeof next === "function" ? next(cards) : next;
  saveFlashcards(cards);
  emit();
}
