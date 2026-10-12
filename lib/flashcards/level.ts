import { useSyncExternalStore } from "react";
import { bandFromStorage, type Band } from "./bands";

/** The level band a player wants to practise, remembered per browser. */
const STORAGE_KEY = "de-app:level-band";
const OLD_KEY = "de-app:max-level"; // before bands: the highest level, converted on read
const DEFAULT: Band = "all";

const listeners = new Set<() => void>();

function read(): Band {
  try {
    return bandFromStorage(window.localStorage.getItem(STORAGE_KEY), window.localStorage.getItem(OLD_KEY));
  } catch {
    return DEFAULT;
  }
}

export function useBand(): [Band, (band: Band) => void] {
  const band = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => DEFAULT, // server: localStorage doesn't exist
  );
  function setBand(next: Band) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Blocked storage (e.g. private mode): the choice can't be kept, so it stays on "All".
    }
    listeners.forEach((l) => l());
  }
  return [band, setBand];
}
