# C1/C2 words for der · die · das — design

Date: 2026-10-12. Agreed with the user in a brainstorming session (answers to 7 questions and
4 design sections). Builds on the der · die · das flashcard deck (`lib/flashcards/data/seed.json`,
976 nouns A1–B2, each linked to one of 41 rules in `rules.json`) and its level picker.

## Goal

The flashcard game covers the same range as the Grammar Topics, A1–C2, with real C1 and C2
nouns rather than empty levels. A learner can pick C and get full 30-card rounds of correct,
well-explained advanced nouns, and in a mixed round a word's level is obvious at a glance.

## Decisions

| Area | Decision |
|---|---|
| Size | About **150 C1 and 100 C2** nouns, from about 300 candidates. |
| Word bar | Educated, advanced everyday language (newspapers, essays, work, public life), e.g. *Abhängigkeit*, *Konsequenz*, *Reportage*. No jargon, slang, archaic or narrow technical words (the CLAUDE.md "no obscure words" rule still applies). |
| Rules | The existing 41 rules **plus six new ones**: `-ist` → der, `-ast` → der, `-ich` / `-ig` → der, `-age` → die, `-ade` → die, `-ette` → die. Left out on purpose: `-ent` (clashes with the `-ment` das rule) and `-at` (people and machines are der); possible later. Every card keeps a rule; no rule-less words. |
| New-rule cards | The six new rules get cards from the C1/C2 words plus a few B2-level words (e.g. *Optimist*, *Garage*), so they aren't C-only. Existing A1–B2 cards are not changed. |
| Levels | Judgement first, with a frequency check: each candidate gets a level and a one-line reason; the frequency rank flags words that look too common (maybe B2) or too rare (maybe obscure). Flags inform the review, never decide alone. |
| Articles | Every article is checked against German Wiktionary, not memory. A mismatch blocks the word. |
| Picker | Four buttons, **A · B · C · All**. Each band gives only its own words (A = A1+A2, B = B1+B2, C = C1+C2). **All is the default.** "Practise my mistakes" ignores the picker, as now. |
| Card level | The faint "B1 · noun" text on the card is replaced by the coloured `LevelBadge` used on the Grammar Topics pages, so a word's exact level (A1–C2) is clearly visible. |
| Saved choices | One-time conversion of the old saved level: A1 or A2 → A, B1 → B, the old "All (A1–B2)" → All. |
| Pipeline | Committed in `scripts/c-levels/` this time, so it can be re-run (the original deck's pipeline was lost). |
| Delivery | Two PRs: (1) scripts and the review sheet, (2) applying the approved words plus the app changes. Branch, `ai-code-reviewer`, `/security-scan-changed` and suggested usability tests for each. |

## Data

New cards have the same fields as today: `id`, `noun`, `article`, `exception`, `ruleId`,
`level`. Ids continue after the highest existing id: the deck has 976 cards but its ids go up
to `seed-995`, because 20 cards were removed in the A1–B2 level pass, so new cards start at
`seed-996`. Existing ids are never changed, and removed ids are never reused, because saved
answers refer to them.

Each new rule has the same fields as the existing ones (`id`, `article`, `title`,
`matchType: "suffix"`, `suffixes`, `description`, `examples`, `exceptions`; `category` is only used by semantic rules), with wording
researched from grammar sources and checked by the reviewer. On `/rules` and on the cards
the ending is bold, as for the existing rules. Where a word breaks its rule (e.g.
*der Nomade* under `-ade` → die), its `exception` text explains why, as existing exceptions
do.

The words are spread over the rules that have real C-level vocabulary (roughly 3–10 per
rule); rules without it (colours, car brands, letters, and so on) get none.

## Pipeline (`scripts/c-levels/`)

1. **`candidates.csv`**: about 300 rows: noun, article, ruleId, level, exception text (if
   any), reason for the level.
2. **`check.mjs`**: for every row:
   - **Article**: looks the noun up on German Wiktionary (`de.wiktionary.org` API, `Genus=`).
     A different gender blocks the row. Nouns with more than one gender and plural-only nouns
     are excluded. Lookups are cached in `wiktionary-cache.json`, at most one request per
     second, with a descriptive User-Agent.
   - **Rule fit**: for suffix rules, the noun must end with one of the rule's endings; if
     the article goes against the rule, the row needs exception text.
   - **Duplicates**: the noun must not already be in `seed.json` (case-insensitive).
   - **Frequency**: rank in `de_50k.txt` (hermitdave/FrequencyWords, OpenSubtitles 2018,
     CC BY-SA 4.0; stored in the folder with its source and license noted). Rank within the
     top ~5,000 → flag "too common, maybe B2"; not in the list → flag "rare, check it isn't
     obscure". The list comes from film subtitles, so it favours spoken language; flags are
     hints only.
   - Writes **`review.csv`**: the candidate columns plus Wiktionary gender, rank, flags and
     a status; problem rows first.
3. **Independent reviewer**: a separate agent on the most capable model checks every row
   (article, natural current German, level, rule fit, exception text). Its findings are
   fixed before the owner sees the sheet.
4. **Owner review**: the owner marks each row in `review.csv` as keep, drop or change level.
5. **`apply.mjs`**: appends only approved rows to `seed.json` with new ids and adds to `rules.json` each new
   rule that at least 3 approved words use (a rule with fewer is left out rather than shipped
   thin). Refuses to run if any row is blocked or unreviewed, or if an id or
   noun would collide. Running it twice changes nothing.

## App changes

- `lib/flashcards/types.ts`: `LEVELS` becomes A1, A2, B1, B2, C1, C2.
- `lib/flashcards/level.ts`: the remembered choice becomes a band (`A`, `B`, `C`, `all`),
  stored under a new localStorage key; on first load the old key is converted once (see
  Decisions). Blocked storage falls back to All, as now. A small pure function says whether
  a level is in a band.
- `components/ArticlesGame.tsx`: the picker shows A · B · C · All; rounds draw from the
  chosen band; the card shows `LevelBadge` instead of the faint level text.
- Unchanged and updating on their own: `/rules` (lists the six new rules), the Progress
  page's accuracy per rule, "Practise my mistakes", saved answers (keyed by card id).
- Docs: CLAUDE.md (deck description and counts, A1–C2), README.

Expected band sizes: A ≈ 270, B ≈ 700, C ≈ 250 cards.

## Testing

- **Data test** (new, `lib/flashcards/data.test.mjs`, part of `npm test` and so of every
  Vercel build): unique ids; valid article, level (A1–C2) and existing ruleId on every card;
  **the original 976 cards unchanged** (id, noun and article checked against a recorded
  fingerprint); new ids start at `seed-996` and continue without gaps; suffix-rule cards end with a rule ending or
  carry exception text; no duplicate nouns; each band has at least 30 cards; every rule
  has a title, description and its endings, and at least 3 cards.
- **Logic tests**: the band filter and the one-time conversion of old saved choices.
- **Browser check** (new `e2e/articles.sh`, playwright-cli, no AI cost): picker shows
  A · B · C · All with All selected by default; choosing C gives only C1/C2 cards with the
  badge visible; an old saved "B1" turns into B; `/rules` shows the six new rules; phone
  width; keyboard play.

## Risks

- **A wrong article** is the one error this game can't afford: covered by the Wiktionary
  check, the reviewer and the owner's review.
- **Obscure words**: covered by the word bar, the frequency flag and the reviews.
- **Wiktionary unavailable or rate-limited**: the cache makes re-runs cheap; a row without a
  lookup stays blocked rather than passing.
- No database change and no AI cost. Saved answers are unaffected because card ids never
  change.

## Out of scope

- The `-ent` and `-at` rules, and any other new rules beyond the six.
- Re-levelling or editing the existing 976 cards.
- New levels for the Grammar Topics (they already span A1–C2).
- AI-generated words at runtime: the deck stays built-in and the same for everyone.
