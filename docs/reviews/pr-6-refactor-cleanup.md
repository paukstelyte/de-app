# ai-code-reviewer report: PR #6

- **Pull request:** https://github.com/paukstelyte/de-app/pull/6 — "Tidy up: safer theme toggle, shared helpers, accurate limit messages"
- **Branch:** `refactor/cleanup` → `main`, reviewed at commit `20e0e7d`
- **Date:** 2026-10-10
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on the PR diff before merging
- **Context:** a clean-up pass. The PR claims no behaviour change except the theme toggle fix and message wording; the reviewer was asked to test that claim.

## Verdict
The no-behaviour-change claim holds. No critical issues and no blocking warnings.

## Findings

### Critical
None.

### Warning
1. **One unmentioned behaviour change, with no effect in practice.** The server's upload check now uses `validateSelection`, which includes the photo limit. `ownedPaths` already rejects more than 5 paths before this point, so nothing changes, but `MAX_PHOTOS` now guards the server rule in two places.

### Suggestion
1. The test helper `f(name, size, type)` in `lib/learning/uploads.test.mjs` still builds a `type` field that nothing reads any more.
2. The 2026-10-09 Customized Learning plan in `docs/superpowers/plans/` still shows the old `mimeFor(file: FileInfo)` signature.
3. A leftover blank line at the start of `ThemeToggle()`.
4. **Existing issue, not caused by this PR:** the inline theme script in `app/layout.tsx` wraps the storage read and the OS-preference fallback in one `try`. With storage blocked, the read throws and an OS-dark user gets the light theme.
5. `NEW_PASSWORD` in `auth-forms.tsx` mixes `<input>` attributes with `hint`, which only `Field` uses. Fine for two call sites; don't spread it onto a raw `<input>`.

### Checks requested, all confirmed
1. **Theme:** nothing else reads React theme state. The toggle flips `data-theme`, saves the same key and values, starts from what the inline script set, and has no theme-dependent output, so hydration is unaffected. The old version threw inside a `setState` updater when storage was blocked; that is fixed.
2. **Upload check:** as strict as before for every path that passes `ownedPaths` (pdf + image, 2 PDFs, a single docx, images incl. HEIC/HEIF, unknown extension, empty list). `mimeFor(path)!` is safe after `validateSelection`, and the `finally` still deletes the files on every early return.
3. **`restart`:** `initialState` has exactly the fields the old version reset; sharing its `[]` and `EMPTY_SCORE` is safe because the reducer never mutates them.
4. **Shared `shuffle`:** same algorithm; `lib/exercises/check.ts` has no server-only code and no Node test loads the flashcard files.
5. **Removed exports:** none of the 13 names is imported anywhere, including `scripts/`, `e2e/`, `supabase/` and the tests.
6. **Password pattern:** identical to the old JSX attribute, and it still matches `supabase/config.toml` (8+ characters, letters and digits).
7. **Wording:** no test asserts the changed text. The texts that are asserted ("Upload at most 5 photos at a time.", "Choose a PDF", "10 MB") render the same.
8. **Course rules:** the OpenRouter call, env vars, `supabase/`, `proxy.ts` and `next.config.ts` are untouched; auth and folder checks in `analyseUpload` still run first.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | No change: two layers checking the same limit is deliberate (the browser check and the server check share `uploads.ts`). Noted here. |
| Suggestion 1 | Fixed: the helper builds `{ name, size }` only. |
| Suggestion 2 | No change: the plan is a dated historical record of how the feature was built. |
| Suggestion 3 | Fixed. |
| Suggestion 4 | Fixed: the storage read has its own `try`, so the OS preference still applies when storage is blocked. Checked in Node: blocked + OS dark → dark; saved light + OS dark → light; nothing saved + OS light → light. |
| Suggestion 5 | No change, as the reviewer advised. |

Re-run after the fixes: `npm test` 129/129, `tsc` and lint clean.
