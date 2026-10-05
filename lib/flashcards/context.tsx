"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Flashcard } from "./types";
import { getServerSnapshot, getSnapshot, setCards, subscribe } from "./store";

interface FlashcardsContextValue {
  cards: Flashcard[];
  recordAnswer: (id: string, wasCorrect: boolean) => void;
}

const FlashcardsContext = createContext<FlashcardsContextValue | null>(null);

export function FlashcardsProvider({ children }: { children: ReactNode }) {
  const cards = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<FlashcardsContextValue>(
    () => ({
      cards,
      recordAnswer: (id, wasCorrect) => {
        setCards((prev) =>
          prev.map((card) =>
            card.id === id
              ? { ...card, incorrectStreak: wasCorrect ? 0 : card.incorrectStreak + 1 }
              : card,
          ),
        );
      },
    }),
    [cards],
  );

  return (
    <FlashcardsContext.Provider value={value}>
      {children}
    </FlashcardsContext.Provider>
  );
}

export function useFlashcards() {
  const ctx = useContext(FlashcardsContext);
  if (!ctx) {
    throw new Error("useFlashcards must be used within a FlashcardsProvider");
  }
  return ctx;
}
