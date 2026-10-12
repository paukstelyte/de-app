# ai-code-reviewer report: PR #18

- **Pull request:** "Submission readiness: README screenshot and optional task, upload counter owner policy, fresh privacy results" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `docs/submission-readiness` → `main`, reviewed at commit `410a58d`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...docs/submission-readiness` before merging. It viewed the screenshot and checked the README against the code; it ran no AI calls or browser scripts.
- **Scope:** README (screenshot, Optional task section, cost and limits wording); migration `20261012130000_upload_usage_owner_policy.sql` (owner-scoped read policy on `learning_upload_usage`, applied to the live database after a rolled-back test); `supabase/tests/cross-user-privacy.sql` (upload-counter checks); `docs/supabase-schema.md`, `docs/testing.md`.
- **Why:** a self-evaluation against the course's code-review criteria found the README missing the screenshot and the optional task, one inaccurate README line, and one table with user data (the upload counter) with RLS on but no owner-scoped policy.

## Verdict
Approve with minor suggestions. No critical issues or warnings. The migration is safe, the docs match the code, and the screenshot shows only test-account content.

## Findings

### Critical
None.

### Warning
None.

### Suggestion
1. The new "B reads A's upload counter (RLS)" check would also return 0 if the policy were missing; add a positive control (A reads their own rows).
2. The README cost range's upper bound ($0.002) has no recorded source in the repo; several examples elsewhere still say $0.0004.
3. The Optional task section's sentence about the Vercel deployment could read as claiming a second task.
4. The README limits sentence leaves out that a failed save also isn't given back.
5. The migration comment slightly oversells "reveals nothing new" (users can now list their own upload times).

### Checks that passed
1. The policy is `for select to authenticated using ((select auth.uid()) = user_id)`; the table has only `id`, `user_id`, `created_at`; `anon` stays revoked; no write grants or policies; inserts still only via `use_upload_quota()`; the admin-key give-back is unaffected; the security-definer functions (`use_upload_quota()`, `upload_allowance()`) bypass RLS and are unchanged.
2. The privacy test's delete check can fail (records "accepted" if not refused); check names match `docs/testing.md`.
3. README facts match the code: a failed AI read is given back, an unreadable photo counts, the "Read by … · tokens · about $…" format, model named in the upload box, screenshot path, Vercel URL.
4. `docs/supabase-schema.md` matches the migrations and `actions.ts`.
5. The screenshot shows the AI output and the model/tokens line, and no email, name, id or secret.

## Security scan of the changed files (2026-10-12)

`/security-scan-changed` scope, Supabase scanner (no Next.js or Vercel files changed, confirmed), with read-only queries against the live database. **0 critical, 0 high, 0 medium, 2 low.**

| # | Low finding | Action |
|---|---|---|
| 1 | No index on `learning_upload_usage.user_id` for the new policy. | No change: the table never holds more than a few hundred rows (rows older than 2 days are deleted; at most 100 uploads a day). |
| 2 | The ascending `id` column, now readable by its owner, hints at the app-wide upload count. | No change: `upload_allowance()` already tells every user the shared uploads left. |

**Checked and fine (live database):** the policy exists exactly as written and is the only one; RLS on for all four user-data tables; `authenticated` has SELECT only on the counter, `anon` and PUBLIC nothing; no sequence grants; no function became more open; the migration is recorded as applied; no secrets in the commit; the screenshot has no personal data.

**Not checked:** the privacy test itself (the scanner was limited to read-only queries; run separately, below); storage policies and the rest of the codebase (unchanged). Noted for the next full `/security-scan`: `anon` has privileges on the `attempts_id_seq` sequence (a Supabase default, not caused by this change).

## What was done about it

| Finding | Action |
|---|---|
| Suggestion 1 | Fixed: a positive control "A reads their own upload counter (owner policy)" (expects > 0). Re-run on the live database: **19/19 pass**. |
| Suggestion 2 | Fixed: the README states the two measured cases ($0.0005 one-page worksheet, about $0.002 several textbook pages) and `docs/testing.md` has a short "AI cost per document" section with the sources. Older examples in the design docs and code comments left as examples. |
| Suggestion 3 | Fixed: the sentence is removed; the section names only the model-and-tokens display. |
| Suggestion 4 | Fixed: "given back only if the AI call fails; a failed save or a photo with no readable text still counts". |
| Suggestion 5 | No change: the migration is already applied, and editing an applied migration's comment isn't worth it; the schema doc describes the access precisely. |
| Security Low 1–2 | No change (reasons above). |
