# C1/C2 words for der · die · das

How the C1/C2 cards were made (design: `docs/superpowers/specs/2026-10-12-c-level-words-design.md`).

1. `candidates.csv`: hand-written candidates (`noun,article,ruleId,level,exception,reason`).
2. `node scripts/c-levels/check.mjs`: checks each word against German Wiktionary (cached in
   `wiktionary-cache.json`, one request a second), its rule, the existing deck and the frequency
   list, and writes `review.csv` (problem rows first). Re-running keeps the `decision` and `note`
   columns.
3. An independent reviewer checks every row; then the owner fills `decision` with keep, drop,
   B2, C1 or C2.
4. `node scripts/c-levels/apply.mjs`: adds approved words to `lib/flashcards/data/seed.json`
   (ids from `seed-996`) and each new rule with at least 3 approved words to `rules.json`.
   Running it twice changes nothing.

`de_50k.txt`: the 50,000 most frequent words in German film subtitles, from
https://github.com/hermitdave/FrequencyWords (OpenSubtitles 2018), licensed CC BY-SA 4.0.
Used only to flag words that look too common or too rare; it favours spoken language.
