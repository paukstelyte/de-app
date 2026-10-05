import { useSyncExternalStore } from "react";
import { LEVELS, type Level } from "./types";

/** The highest level a player wants to practise, remembered per browser. */
const STORAGE_KEY = "de-app:max-level";
const DEFAULT: Level = "B2"; // everything

const listeners = new Set<() => void>();

function read(): Level {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return LEVELS.includes(stored as Level) ? (stored as Level) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useMaxLevel(): [Level, (level: Level) => void] {
  const level = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => DEFAULT, // server: localStorage doesn't exist
  );
  function setLevel(next: Level) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Blocked storage (e.g. private mode): the choice can't be kept, so it stays on "All".
    }
    listeners.forEach((l) => l());
  }
  return [level, setLevel];
}

export function isAtOrBelow(level: Level, max: Level): boolean {
  return LEVELS.indexOf(level) <= LEVELS.indexOf(max);
}
