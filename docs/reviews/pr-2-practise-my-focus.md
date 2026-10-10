# ai-code-reviewer report: PR #2

- **Pull request:** https://github.com/paukstelyte/de-app/pull/2 — "Add Practise my focus and send signed-out visitors to login"
- **Branch:** `feature/practise-my-focus` → `main`, reviewed at commit `1cff61c`
- **Date:** 2026-10-10
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on the PR diff before merging
- **Reviewer's own checks:** `npm test` 129/129 passing, `tsc --noEmit` clean, eslint clean on the changed folders; no files edited

## Findings

### Critical
None.

### Warning
1. **Guests now get a redirect instead of an intro page.** Signed-out visitors opening `/learning` used to see the intro with Log in / Sign up buttons; now they go straight to `/login`. The nav still shows "Customized Learning" to guests, so that link now opens the login form. Intended, but say so in the PR body and README.
2. **The e2e check doesn't cover the new route.** `e2e/learning.sh` check 1 tests the redirect for `/learning` only; nothing checks that a guest opening `/learning/practice` by direct URL lands on `/login?next=/learning/practice`.
3. **The practice page loads more than it uses.** `lib/learning/load-focus.ts` selects `extracted_text`, `model` and the usage columns for up to 200 documents, but the practice page only needs `created_at`, `title` and `suggestions`. It stays on the server, but each visit reads every document's full text for nothing.

### Suggestion
4. The same "topics that have a practice set" filter runs three times (both pages and `focusPracticeItems`).
5. `practiceHref` is never used on the focus page (it's only read for guests, and the focus page is always logged in).
6. `slug="focus"` is a placeholder; a comment should say so (an untagged item would silently not be saved).
7. `TopicItem` and `SessionItem` both describe `ExerciseItem & { topic }`.
8. `makeRound` returns `ExerciseItem[]`, which loses `topic` in the types and forces an explicit `useState<SessionItem[]>`; making it generic removes that.

### Course-requirement checks
- **Signed-out visitors, including direct URLs: confirmed, two layers.** `proxy.ts` redirects every path starting with `/learning`; each page also checks `getClaims()` and redirects. Data access is safe even without the redirects: the server actions check the session themselves, and `loadFocus` runs through the user's own Supabase client, so RLS limits it to their rows. The practice page only reads.
- **Answers saved only for the logged-in user, with server-checked correctness: confirmed.** `recordExerciseAnswer` is unchanged: it rejects unknown topics and items, returns early for guests and computes `correct` on the server. The browser now sends `item.topic`; a tampered topic can only point at another real item, and correctness is checked against that item. Sending each question's own topic matters because `past-perfect` and `personal-pronouns` both use ids `pp-01`…`pp-10`.
- **Nothing new reaches the browser that shouldn't: confirmed.** The client gets exercise items (now with `topic`) and topic titles, the same public content `/topics/[slug]/practice` already serves. Document text, costs and focus rows stay on the server.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Intended (agreed with the project owner). Stated in the PR description and the README. The login page takes the visitor back to `/learning` afterwards (`next=`). |
| Warning 2 | Fixed: `e2e/learning.sh` now also checks that a guest opening `/learning/practice` lands on `/login?next=%2Flearning%2Fpractice`. |
| Warning 3 | Fixed: `loadFocus(supabase, { withDocuments })` reads only `id, title, created_at, suggestions` unless the document list needs the full rows. |
| Suggestion 4 | Fixed: one `practiceTopics()` helper used by both pages and by `focusPracticeItems`. |
| Suggestion 5 | Fixed: the focus page no longer passes `practiceHref`. |
| Suggestion 6 | Fixed: comment added. |
| Suggestion 7 | Kept: `SessionItem` has an optional topic (single-topic pages), `TopicItem` a required one (focus pool); both are assignable where needed. |
| Suggestion 8 | Fixed: `makeRound<T>` is generic; the explicit state type is gone. |

Re-verified after the fixes: `npm test` 129/129, `tsc`, lint and build clean; signed-out `/learning/practice` → 307 to `/login?next=%2Flearning%2Fpractice`; logged-in browser check passed again (button shown, topic label shown, answer saved under its own topic).
