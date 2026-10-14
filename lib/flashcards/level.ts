import { storedChoice } from "../storedChoice";
import { bandFromStorage } from "./bands";

const OLD_KEY = "de-app:max-level"; // before bands: the highest level, converted on read (inside storedChoice's try)

/** The level band a player wants to practise, remembered per browser ("All" by default). */
export const useBand = storedChoice("de-app:level-band", (stored) => bandFromStorage(stored, window.localStorage.getItem(OLD_KEY)), "all");
