// Step 1 of levelling: give each seed card the lowest Goethe list it appears on.
//   Sources (download into this folder, then `pdftotext -layout X.pdf X.txt`):
//   A1 https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf
//   A2 https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_A2_Wortliste.pdf
//   B1 https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf
// A noun counts as on a list when it appears there as a capitalised whole word
// (headword or example sentence, e.g. "beim Bäcker").
// Writes levels-matched.csv and levels-review.csv (unmatched; level to be
// proposed and reviewed by hand). apply-levels.mjs then writes seed.json.
import { readFileSync, writeFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url);
const seed = JSON.parse(readFileSync(here("../../lib/flashcards/data/seed.json"), "utf8"));

// Where each list's vocabulary starts/ends — the intro and bibliography pages
// mention words (Wissenschaft, Konferenz…) that aren't part of the level.
const SECTIONS = {
  A1: [/^\s+Zahlen\s*$/m, /^\s+Literatur\s*$/m],
  A2: [/Abkürzungen\s+Anweisungssprache/, null],
  B1: [/ABKÜRZUNGEN/, null],
};

const nounsByLevel = Object.entries(SECTIONS).map(([level, [start, end]]) => {
  let text = readFileSync(here(`${level}.txt`), "utf8");
  text = text.slice(text.search(start));
  if (end) text = text.slice(0, text.search(end));
  const nouns = new Set(text.match(/(?<![\p{L}-])[A-ZÄÖÜ][a-zäöüß]+(?![\p{L}-])/gu));
  return [level, nouns];
});

const matched = [];
const review = [];
for (const card of seed) {
  const hit = nounsByLevel.find(([, nouns]) => nouns.has(card.noun));
  (hit ? matched : review).push([card.id, card.article, card.noun, hit?.[0] ?? ""]);
}

const csv = (rows) => ["id,article,noun,level", ...rows.map((r) => r.join(","))].join("\n") + "\n";
writeFileSync(here("levels-matched.csv"), csv(matched));
writeFileSync(here("levels-review.csv"), csv(review));
const count = (l) => matched.filter((r) => r[3] === l).length;
console.log({ A1: count("A1"), A2: count("A2"), B1: count("B1"), unmatched: review.length });
