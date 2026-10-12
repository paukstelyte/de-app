# ai-code-reviewer report: PR #15

- **Pull request:** "C1/C2 words, part 2: words in the game, A · B · C · All picker, level badge" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `feature/c-level-words` → `main`, reviewed at commit `dec43da` (base `f90d774`, where PR #14 ended)
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`) on the most capable model, as the final whole-branch review before merging. It ran the tests, type check and lint, and checked the data with node; it did not run the browser scripts.
- **Scope:** plan Tasks 5–10 of `docs/superpowers/plans/2026-10-12-c-level-words.md`: `apply.mjs`; six levels, bands and band storage; the picker and the card badge in `ArticlesGame.tsx`; the owner's decisions; 310 new cards and 6 new rules; the deck data test; `e2e/articles.sh`; docs.
- **Earlier reviews on this branch:** every task had its own spec and quality review (Task 9 needed one fix round: the browser check now proves cards advance). The controller also checked the game by eye (light and dark mode, phone width).
- **Course-requirement checks requested:** no new packages, secrets only in env files, OpenRouter untouched, branch and PR, CLAUDE.md flashcard rules.

## Verdict
Ready to merge after two small fixes. Nothing critical. The data is right, the code is minimal, and the existing deck is protected.

## Findings

### Critical
None.

### Warning
1. **New rule endings bolded text inside words on two existing cards.** The shared formatter (`lib/flashcards/ruleFormatting.tsx`) bolds every rule ending wherever it appears, so the new `-age` matched inside "non-agentive" (*Mutter*) and "feminine-agent" (*Termin*). Older partial bolds of the same kind existed too ("-e" inside "-el", "-in" inside "-ing"). The original cards are fingerprint-locked, so the fix belongs in the formatter.
2. **`docs/testing.md` gave the wrong count for `e2e/articles.sh`.**

### Suggestion
1. The ending-fit check exists twice (`scripts/c-levels/lib.mjs` and the data test), slightly differently (the test also accepts exception text).
2. `LEVELS` in `lib/flashcards/types.ts` lost its last user.
3. `BAND_LABELS` adds little.
4. The old saved level key is converted on every read and never removed (same behaviour; the spec says "converted once").
5. Behaviour changes for existing users, as the spec and owner decided: guests with no saved choice, and anyone who saved "All (A1–B2)", now get C words in their rounds (295 of 1,286 cards, about 23%); a saved "A1–B1" becomes band B (no A words, adds B2). Say so in the PR.
6. The `/articles` breadcrumb said "Noun gender · A1", which reads wrong on a page with A1–C2 badges.
7. Save this report in `docs/reviews/` before merging.

### Deferred-list triage
- **Must fix:** the `docs/testing.md` count.
- **Should fix:** Warning 1; *Kassette* still listed among the `-ette` rule's examples although its card was dropped as dated.
- **Can wait:** pipeline robustness items (prefix message wording, CSV edge case, retries, cache key case), *Ballast*, *Frist* reason text, `applyReview` skip and write order, `aria-label` on the badge wrapper, no cross-tab storage listener, README `npm test` wording, sleeps in the browser script. All earlier rulings are reasonable.

### Checks that passed
1. `npm test` 154/154, `tsc` and lint clean.
2. 1,286 cards with level counts matching the docs (A1 139, A2 133, B1 443, B2 276, C1 180, C2 115); new ids `seed-996`–`seed-1305` without gaps; all 15 B2 cards on the six new rules; every new card fits its ending; every rule-breaking card explains why.
3. The first 976 cards are byte-identical to the base and the first 41 rules content-identical; the format-only `rules.json` commit changes no content; running `applyReview` again adds nothing.
4. No hydration race; "Practise my mistakes" still ignores the band; `/progress` and saved answers handle the new rules and ids; `/rules` groups the new rules correctly.
5. CLAUDE.md flashcard rules untouched (rounds of 30, keyboard focus, `role="status"`, needs-practice badge, recap); only the corner label became the coloured badge.
6. No package, lockfile or env change; OpenRouter untouched; the browser script runs as a guest.

## Security scan of the changed files (2026-10-12)

`/security-scan-changed` ran the Supabase, Next.js and Vercel scanners (read-only) on the 18 changed files across 7 commits. **0 critical, 0 high, 0 medium, 1 low.**

| # | Low finding | Flagged by | Action |
|---|---|---|---|
| 1 | The data test's fingerprint fails the Vercel build (`npm test && npm run build`) if an original card is edited. Intended, but someone fixing a typo may not see why. | Vercel | Fixed: a comment above `ORIGINAL_FINGERPRINT` explains that a deliberate correction updates it in the same commit. |

**Checked and fine:** no Supabase changes; the live `attempts` table only limits `item_id` to 1–64 characters, so the new ids (8–9 characters) save normally (checked read-only on the live database); `recordAttempt` accepts only ids in the deck, so new ids work and made-up ids are still refused, with correctness decided on the server; the saved band from localStorage is never trusted (junk falls back to All, tested) and only filters cards; no secrets in the deck data or this branch's commits; new text renders as plain text; no env vars read; the data tests pass offline; `seed.json` grew from about 12 KB to 16 KB gzipped, loaded only on `/articles`.

**Not checked:** preview protection and live headers (unchanged by this branch); saving a C-card answer end to end while logged in (would write to the database).

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Fixed in the formatter: an ending is bolded only when no letter follows it, and a prefix (*Ge-*) only when no letter precedes it. Bold fragments across all rule and card texts went from 177 to 157; *Mutter* and *Termin* are clean; **-ung**, **-ette** and **Ge-** still bold. |
| Warning 2 | Fixed: `docs/testing.md` gives the real count from a fresh run, 22/22. |
| *Kassette* example | Fixed: removed from the `-ette` rule's examples in `rules.json` and `scripts/c-levels/new-rules.json`. |
| Suggestion 6 | Fixed: the breadcrumb reads "Grammar Topics › Noun gender", like `/rules`. |
| Suggestion 5 | Stated in the PR description. |
| Suggestion 7 | This report. |
| Suggestions 1–4 | No change: the one-line fit check is kept separate from the scripts on purpose; the unused export and label map are harmless; the old key's behaviour is the same. |
| Security Low 1 | Fixed: comment above the fingerprint. |

Re-run after the fixes: `npm test` 154/154, `tsc`, lint and build clean, `bash e2e/articles.sh` PASS (22 checks).
