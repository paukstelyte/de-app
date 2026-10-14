# ai-code-reviewer report: PR #19

- **Pull request:** https://github.com/paukstelyte/de-app/pull/19 — "Simplify hand-written code: one flashcard hook, shared styles, tidy-ups"
- **Branch:** `simplify-hand-rolled-code` → `main`, reviewed at commit `9b62098`
- **Date:** 2026-10-14
- **Reviewer:** the `ai-code-reviewer` subagent, run on `git diff main...HEAD` before merging.
- **Scope:** 23 files (20 changed, 3 deleted). Tests (159/159) and `tsc --noEmit` pass; the reviewer compiled `globals.css` to confirm CSS order.

## Verdict
No critical issues. Three small visual or behaviour notes, and five suggestions. Four suggestions are fixed in the follow-up commit.

## Findings

### Warning
1. **Primary buttons on `/` and `/learning` now fade on hover.** Those two copies of `pillPrimary` had no `transition-colors`; the shared `pill` utility has it. A small visual change. *Kept: it makes all buttons consistent.*
2. **All pills now carry `disabled:` styles.** These used to exist only in `ExerciseSession`. No other pill is ever disabled, so nothing changes today. *Kept.*
3. **The `ExerciseSession` login link is hard-coded to `/topics/${slug}/practice`.** On the focus page (`slug="focus"`) it would point to a 404, but it never shows there because that page requires login. *Kept: the old prop was never passed.*

### Suggestion
4. **One "How to use" heading in `ArticlesGame` still used the inline heading string.** *Fixed: it now uses `section-heading`.* The accent-shadow panels in `topics/[slug]` and `UploadBox` differ from `panel` and stay inline.
5. **The `store.ts` comment claimed only `/articles` downloads the word list because of the hook.** That's misleading: `RULE_TEXT_BY_ID` also pulls it in. *Fixed: the comment is reworded.*
6. **Double blank lines were left where constants were removed.** *Fixed.*
7. **`DocumentList`'s `Doc` type comes from the server-only `load-focus.ts` via `import type`.** The type import is removed at build time and the build passes. *Kept.*
8. **`freeAtLabel` now relies on the browser's locale data (`toLocaleTimeString`).** The output is the same and the test passes. *Kept.*

### Checked, no change found
- **CSS order:** `border-red-300` still overrides `panel`'s border.
- **Hover and dark mode:** the hover and dark-mode rules keep their order.
- **Store hydration:** unchanged; `recordAnswer` now loads the deck first, which is safer.
- **Badge and `ACCEPT`:** the badge markup and the `ACCEPT` string are identical to before.
- **Removed code:** nothing removed is still referenced.

## Security scan (`/security-scan-changed`)
Supabase, Next.js and Vercel scanners: 0 critical · 0 high · 0 medium · 0 low.
