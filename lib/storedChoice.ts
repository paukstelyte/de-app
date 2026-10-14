import { useSyncExternalStore } from "react";

/** A small choice remembered in this browser (localStorage), shared by every component that reads it.
 * `parse` turns the stored text into a valid choice; `fallback` is used on the server, where there is
 * no localStorage, and when storage is blocked (e.g. private mode). */
export function storedChoice<T extends string>(key: string, parse: (stored: string | null) => T, fallback: T) {
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const read = () => {
    try {
      return parse(window.localStorage.getItem(key));
    } catch {
      return fallback;
    }
  };
  function set(next: T) {
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Blocked storage: the choice can't be kept, and readers keep seeing what was stored before.
    }
    listeners.forEach((l) => l());
  }
  return (): [T, (next: T) => void] => [useSyncExternalStore(subscribe, read, () => fallback), set];
}
