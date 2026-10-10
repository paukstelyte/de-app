# ai-code-reviewer report: PR #4

- **Pull request:** https://github.com/paukstelyte/de-app/pull/4 — "Guard server-only data files and clean up the upload counter"
- **Branch:** `fix/server-only-and-quota-cleanup` → `main`, reviewed at commit `cba5ff6`
- **Date:** 2026-10-10
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on the PR diff before merging
- **Context:** fixes findings #4 (server-only guard) and #9 (upload counter cleanup) from the full security scan of 2026-10-10

## Findings

### Critical
None.

### Warning
1. **Broken README link.** The README's PR list links to `docs/reviews/pr-4-server-only-and-cleanup.md`, which didn't exist on the branch yet.

### Suggestion
1. **The docs said slightly more than the SQL does.** "Each call also deletes rows older than 2 days" holds only for successful calls. A call refused at the limit (`P0001`) rolls back, delete included. The next successful call cleans up, so nothing breaks.
2. **The delete runs under the global advisory lock**, so every upload waits for it. In practice this is cheap: the 100-a-day cap keeps the table tiny, and `learning_upload_usage_created_idx` covers the `created_at <` filter. No change needed.

### Checks requested, all confirmed
1. **Nothing in the browser or tests imports the guarded files**, directly or transitively.
   - None of the 13 `"use client"` files reaches `lib/supabase/server`, `lib/attempts` or `lib/learning/load-focus`.
   - Client components call server actions through `"use server"` files, so their imports stay on the server.
   - `components/auth-button.tsx` is a server component.
   - No test imports a guarded module.
   - `server-only` resolves through Next's built-in copy, the same way `lib/learning/analyse.ts` already did.
2. **`create or replace function` keeps the owner and the existing grants** (anon revoked, `authenticated` execute). The migration restates `security definer` and `search_path = ''`, and the signature is unchanged.
3. **The delete can't affect the 24-hour limits.** It removes rows older than 2 days, while the limits count the last 24 hours, so the ranges don't overlap. `now()` is fixed for the whole transaction, and the delete runs after the advisory lock, so concurrent calls are serialised.
4. **The only change to the function body is the `delete` line.** The checks, the lock key, both thresholds, the error codes and the insert are identical to migration `20261010100000`.

No dead code, duplication, over-engineering or silent behaviour changes found.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Fixed: this report is committed on the branch before merging, so the link resolves. |
| Suggestion 1 | Fixed: `docs/supabase-schema.md` and the migration's header comment now say "each successful call", and that a refused call rolls back. The comment-only change to the already-applied migration doesn't affect the database. |
| Suggestion 2 | No change, as the reviewer advised. |
