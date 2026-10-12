# ai-code-reviewer report: PR #7

- **Pull request:** "Show uploads left and saved documents on the upload card" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `feature/upload-allowance` → `main`, reviewed at commit `8260ded`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...feature/upload-allowance` before merging. It read the diff and the previous quota migration; it did not run tests or SQL.
- **Scope:** migration `20261012100000_upload_allowance.sql`, `app/learning/actions.ts`, `app/learning/page.tsx`, `components/learning/UploadBox.tsx`, `lib/learning/allowance.ts` and its test, `supabase/tests/upload-allowance.sql`, `e2e/lib.sh`, docs.
- **Course-requirement checks requested:** OpenRouter server-side only, no `NEXT_PUBLIC_` secrets, `SUPABASE_SECRET_KEY` only in server code, RLS on every new table, no new packages. (The security scan of the changed files was run afterwards; see the last section.)

## Verdict
Approve with changes. Migration, grants and deploy order are sound; two Warnings needed fixing before merge.

## Findings

### Critical
None.

### Warning
1. **Refund after a completed AI call allowed unlimited paid calls.** The 200-document limit is only hit at the insert, after the AI had already been paid for. Refunding there let a user at 200 documents upload repeatedly at no quota cost.
2. **The "frees up at" time was wrong on first load.** It was formatted with the server's timezone and `suppressHydrationWarning` kept that text.
3. **Accessibility of the blocked state.** The `role="status"` messages were only mounted when the state flipped (often not announced), and nothing told a screen-reader user why the input was disabled.
4. **Docs were stale.** README and `docs/testing.md` said `SUPABASE_SECRET_KEY` is used only by account deletion.

### Suggestion
- Limits (10, 100, 200) are hardcoded in several places.
- The error text said "the box above" from inside the card.
- The blocked state does not clear by itself after the window passes (needs a reload).
- When both limits are full, `next_free_at` shows the user's time, not the later of the two.
- `giveBackUpload` builds an admin client per call (the account page does too); a shared `lib/supabase/admin.ts` would remove the duplication.
- The SQL test deletes all usage rows inside a transaction on the live database (rolls back, but takes locks); the status expression had a redundant clause; it did not check that a signed-in user cannot delete usage rows directly.
- `UPLOAD_NOTE` was shortened (a visible copy change, worth stating in the PR).

### Checks that passed
1. `use_upload_quota()` keeps the same limits, lock, 2-day cleanup, error codes, `search_path` and grants; only the return type and `returning id` changed.
2. Grants re-applied after the drop and create: both functions refused for `anon`.
3. No refund path through the API: `learning_upload_usage` has RLS on and no privileges for `anon` or `authenticated`; the delete uses the admin key, server-only.
4. `upload_allowance()` filters on `auth.uid()` and returns only the caller's count and the shared total.
5. Deploy order: migration first is safe (old code ignores the new return value); new code on the old database would break, so the migration must go first (it already has been applied).
6. Course rules: OpenRouter untouched, no `NEXT_PUBLIC_` secret added, the secret key read only in `"use server"` files, no new tables, no new packages, `.env.e2e` is git-ignored.
7. The document count from `docs?.length` is exact (the query is capped at 200).
8. The unit tests cover `parseAllowance` and both `freeAtLabel` branches independent of timezone.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Fixed two ways. The document count is now checked **before** the AI call (the trigger stays as a backstop), and a failed save is no longer given back. Only a failed AI read (`ai` / `unreadable`) is refunded. A read that finds no grammar still counts. |
| Warning 2 | Fixed: the time is formatted in the browser after load (`useSyncExternalStore`). Until then the card says "within 24 hours". Checked in the browser: "tomorrow at 07:12" in local time. |
| Warning 3 | Fixed: an always-present `role="status"` region (hidden when empty) holds the message, and the disabled input has `aria-describedby` pointing at it. |
| Warning 4 | Fixed: README and `docs/testing.md` list the files that use the secret key. |
| Suggestion: error text | Fixed: it now points at "Uploads left today". |
| Suggestion: hardcoded limits | Partly: a "keep in sync" comment on `MAX_DOCUMENTS`; the per-user limit already comes from the database. |
| Suggestion: SQL test | Fixed: added the "no self-refund" check (11/11 pass on the live database) and tidied the status expression. The all-rows delete stays: the shared-limit check needs a clean slate, the script is wrapped in `begin`/`rollback`, and the header says so. |
| Suggestion: both limits full | No change, minor. The user's own time is shown first; the page updates once their slot frees. |
| Suggestion: blocked state not clearing | No change; a reload or the next upload attempt updates it. |
| Suggestion: shared admin client | No change; two call sites don't justify a new file yet. |
| Suggestion: `UPLOAD_NOTE` | Noted here: the note lost the format list and "such as" wording because the dropzone label directly above already shows them. |

Re-run after the fixes: `npm test` 132/132, `tsc` and lint clean, `supabase/tests/upload-allowance.sql` 11/11.

## Security scan of the changed files (2026-10-12)

The three scanners (Supabase, Next.js, Vercel) ran read-only on the 14 changed files of the 2 commits, following the `/security-scan-changed` procedure. The Supabase scanner checked the live database with read-only selects. Result: **0 critical, 0 high, 0 medium, 4 low.**

| # | Low finding | Flagged by | Action |
|---|---|---|---|
| 1 | The admin delete in `giveBackUpload` matched on the row id only (the admin key skips row-level security). Not exploitable today: the id always comes from the caller's own quota call. | Next.js | Fixed: the delete also matches `user_id`. |
| 2 | An upload is given back on any AI failure, including `unreadable`, so someone who can trigger failures reliably could make calls without using quota. | Supabase | Accepted. `unreadable` happens before any AI call (no cost); a failed AI call costs almost nothing; the daily upload cap still limits successful reads. Refunds after a paid, saved result are not given. |
| 3 | `SUPABASE_SECRET_KEY` must be set for Production and marked Sensitive in Vercel, because refunds now read it. If missing, nothing crashes; the refund is skipped and logged. | Vercel | **To confirm in the Vercel dashboard** (the scanner could not read it: Vercel CLI not installed). |
| 4 | `upload_allowance()` shows any signed-in user the shared remaining count and the time the oldest upload frees up. No user ids or rows. | Supabase | Accepted: intended, and the shared limit is what the page has to explain. |

Also noted and not acted on: the document-count pre-check can race with a parallel upload (the database trigger still enforces the limit, costing one wasted AI call), and the admin client is built in two places (a shared `lib/supabase/admin.ts` is optional).

**Checked and fine:** both functions are refused for `anon` and open to `authenticated` only (live ACLs); `security definer` with an empty `search_path`; exactly one `use_upload_quota`, returning `bigint`; `learning_upload_usage` closed to `anon` and `authenticated` with RLS on; no secret in client code or props; no secret in this branch's commits; `.env.e2e` and `.env.local` git-ignored and untracked; migration-before-code deploy order is safe.

**Not checked:** Vercel dashboard settings, live security headers, whether a secret was committed earlier in history (only this branch's commits were searched), dependency versions.
