# ai-code-reviewer report: PR #14

- **Pull request:** "C1/C2 words, part 1: pipeline and review sheet" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `feature/c-level-words` → `main`, reviewed at commit `f8ea7e4`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...feature/c-level-words` before merging. It ran the tests and lint; it did not run `check.mjs` (network).
- **Scope:** PR 1 of 2 for the C1/C2 words (spec `docs/superpowers/specs/2026-10-12-c-level-words-design.md`, plan Tasks 1–4): the pipeline in `scripts/c-levels/` (`csv.mjs`, `lib.mjs` and tests, `check.mjs`, `new-rules.json`, `de_50k.txt`, `README.md`, `candidates.csv`, `review.csv`, `wiktionary-cache.json`), the spec and plan, and the `npm test` glob. No app or deck data changes.
- **Earlier reviews on this branch:** each task had its own spec and quality review; an independent German reviewer checked all 322 candidate words and the six new rules (13 dropped, 2 levels changed, 2 exception texts and 4 rule texts rewritten), and a re-review confirmed every fix.
- **Course-requirement checks requested:** no new packages, secrets only in env files, OpenRouter untouched, branch and PR.

## Verdict
Approve after small doc fixes. No Critical issues. The pipeline is small and pure, has no new dependencies, and its tests pass; the `npm test` glob change is safe. All 310 rows of `review.csv` are `ok`, every article matches Wiktionary, and no B2 word is outside the six new rules.

## Findings

### Critical
None.

### Warning
1. **The plan disagreed with itself on PR scope:** "PR 1: Tasks 1–5" in Global Constraints, while the headers put Task 5 in PR 2.
2. **The spec listed a `category` field for the new rules**, which suffix rules don't have (only the 12 semantic rules do); `new-rules.json` correctly leaves it out.
3. **README step 4 and the `lib.mjs` header mention `apply.mjs`**, which only arrives in PR 2.
4. **"B2 words are only for the six new rules" was not enforced in code**: `checkRow` accepted B2 on any rule (the data obeyed it).
5. **The review report was missing** (this file).

### Suggestion
1. `wiktionary-cache.json` held 23 entries for words no longer in the candidates.
2. A Wiktionary answer with an error body is cached as "no German entry" for good (fails safe: the word stays blocked).
3. The frequency flag can't tell words apart that are spelled the same: *Hast* gets rank 49 from the verb form "hast". Worth telling the owner.
4. Two test assertions only check constants.
5. `?? ""` fallbacks in `mergeDecisions` never fire.
6. 180 C1 and 115 C2 rows are above the spec's "about 150 / 100": expected, since the owner's review will cut some.

### Checks that passed
1. The `npm test` glob only adds `scripts/c-levels/lib.test.mjs`, which imports only the pure modules: no network or file access in the Vercel build (`npm test && npm run build`). 140/140 tests passed.
2. Lint clean; no new packages; no keys or env access; nothing touches OpenRouter or the app.
3. Wiktionary manners: one request a second at most, a project User-Agent, cached, and an error response stops the run instead of passing the word.
4. The `ge-` prefix rule is treated as a prefix, with a test.
5. `de_50k.txt` is credited with source, corpus and licence (CC BY-SA 4.0); committing it for a re-runnable pipeline is reasonable and intended by the spec.
6. README steps 1–3 and the spec's checks match the code.
7. Review sheet: 310 rows matching `candidates.csv`; all `ok`; no decision filled yet; each new rule has at least 3 rows (fewest: `der-ich-ig`, 4); B2 rows (15) all on new rules; a spot check of about 35 rows (every 15th, all B2, all exceptions, the thin rules) found no wrong articles and correct exception texts.
8. The deck's highest id is `seed-995` (976 cards), matching "new ids start at `seed-996`".

## Security scan of the changed files (2026-10-12)

`/security-scan-changed` ran the Supabase, Next.js and Vercel scanners (read-only) on the 13 changed files across 7 commits. **0 critical, 0 high, 0 medium, 1 low.**

| # | Low finding | Flagged by | Action |
|---|---|---|---|
| 1 | `check.mjs` looked up the cache with a truthiness check on a plain object, so a noun spelled like a built-in property (`constructor`) would hit the object prototype. Can't happen with real German nouns (capitalised), and only affects this offline script. | Next.js | Fixed: `Object.hasOwn(cache, noun)`. |

**Checked and fine:** no Supabase use; no `process.env` or `NEXT_PUBLIC_`; no secrets in this branch's commits (searched for key patterns; the repo is public); nothing in `app/`, `lib/` or `components/` imports `scripts/c-levels`, so none of it reaches the browser; `check.mjs` only calls one fixed HTTPS address with the noun URL-encoded, and stores only der/die/das/null plus fixed reason strings, so Wiktionary content can't inject into the cache or `review.csv` (no cells start with `=`, `+` or `@`); file writes go only to two fixed files next to the script; the Vercel build still passes and makes no outbound requests; no config or env files changed.

**Not checked:** an actual Vercel build of this branch (that would deploy); live headers and preview protection (unaffected; for the periodic full scan); `apply.mjs` and the app changes (PR 2).

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Fixed: the plan now says PR 1 = Tasks 1–4, PR 2 = Tasks 5–10. |
| Warning 2 | Fixed: the spec lists the suffix-rule fields without `category`. |
| Warning 3 | Fixed: "(added in PR 2)" after the first mention in the README and in `lib.mjs`. |
| Warning 4 | Fixed (test first): `checkRow` blocks a B2 row whose rule isn't one of the six new ones; `check.mjs` passes the new rule ids. |
| Warning 5 | Fixed: this report. |
| Suggestion 1 | Fixed: the cache now holds only the 310 candidates. |
| Suggestions 2–5 | No change: failed lookups fail safe; the *Hast* flag is a hint and is mentioned to the owner; the constant assertions and fallbacks are harmless. |
| Suggestion 6 | No change: the owner's review decides the final counts. |
| Security Low 1 | Fixed: `Object.hasOwn`. |

Re-run after the fixes: `npm test` 141/141, `tsc` and lint clean, `check.mjs` 310 rows, all `ok` (B2 15, C1 180, C2 115), `review.csv` unchanged.
