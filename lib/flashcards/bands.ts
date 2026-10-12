import type { Level } from "./types";

/** The level picker's choices: each band holds only its own words. */
export const BANDS = ["A", "B", "C", "all"] as const;
export type Band = (typeof BANDS)[number];

export const BAND_LABELS: Record<Band, string> = { A: "A", B: "B", C: "C", all: "All" };

export function inBand(level: Level, band: Band): boolean {
  return band === "all" || level.startsWith(band);
}

// Before bands, the picker saved the highest level: "B2" meant everything (A1–B2).
const FROM_OLD_LEVEL: Record<string, Band> = { A1: "A", A2: "A", B1: "B", B2: "all" };

/** The band to show: the saved band, else the old saved level converted, else All. */
export function bandFromStorage(saved: string | null, oldSaved: string | null): Band {
  if (BANDS.includes(saved as Band)) return saved as Band;
  return (oldSaved && FROM_OLD_LEVEL[oldSaved]) || "all";
}
