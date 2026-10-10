# ai-code-reviewer report: PR #3

- **Pull request:** https://github.com/paukstelyte/de-app/pull/3 — "Document the AI feature, rules, references and test results"
- **Branch:** `docs/submission` → `main`, reviewed at commit `32f10fb`
- **Date:** 2026-10-10
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on the PR diff before merging
- **Reviewer's own checks:** `npm test` 129/129 (re-run). Verified against the code:
  - the model slug, `server-only`, and that `OPENROUTER_API_KEY` is read only in `lib/learning/analyse.ts` and `SUPABASE_SECRET_KEY` only in `app/account/actions.ts`;
  - the 82 topics and 81 × 30 exercises;
  - the limits in the migrations, file types, deletion in `finally`, and the redirects;
  - `.env*` git-ignored, the 30-day focus window, and both earlier review reports;
  - that removing `usage: { include: true }` is safe.
- No files edited.

## Verdict
All five course requirements checked are met. There were no critical issues. The findings are about tests that didn't prove what they claimed, and a few overclaims.

## Findings

### Warning
1. **`docs/testing.md`'s `e2e/learning.sh` result predates the current script.** It says "29/29 (2026-10-09)", but check 1 was changed on 2026-10-10 (PR #2) to the login redirects, so the browser test of the redirects that the docs describe hasn't been run end-to-end yet.
2. **"B deletes A's documents = 0" proved nothing.** The setup counted documents by users other than B, not A's own; if A has none, deleting 0 rows is meaningless.
3. **"B lists files in other users' folders = 0" proved nothing.** The bucket is normally empty, because uploads are deleted after reading.
4. **"B adds to A's focus list → 42501" comes from the missing column grant on `user_id`, not from RLS** (the same applies to the older "document under someone else's account" line). Isolation holds, but the docs presented it as an RLS proof.
5. **`exception when others` counted any error as "refused"**, including typos or a missing table.
6. **"PDFs up to 20 pages" overclaims.** The page count is a regex on uncompressed page objects; compressed object streams pass uncounted (the code's own `ponytail:` comment says so).
7. **CLAUDE.md "only the title, the text read and the suggestions are stored" is incomplete.** Rows also hold `no_grammar`, `model`, the token counts and the cost, and each upload adds a row to `learning_upload_usage`.
8. **README now documents `supabase db push`**, but older migrations were applied with `db query -f`. If they're not in the migration history, `db push` would re-run them all. Check `npx supabase migration list` first.

### Suggestion
1. The SQL test should check that both test users exist, because a missing B gives a null `auth.uid()` and a false pass. Its header said "read-only", though it runs a DELETE and an INSERT, both rolled back.
2. `docs/testing.md` hard-codes the project ref while the other docs use `<ref>`.
3. The only recorded cost reading predates the `usage` change. Also, the new comment in `analyse.ts` belongs where `readUsage` is called.
4. "10 uploads a day" is a rolling 24 hours, and an upload counts even if the AI call fails.
5. The README's `npm test` description leaves out the progress, trouble-word and safe-redirect tests.
6. The upload note says "JPG/PNG/HEIC", while the README and error message also list WebP.
7. Click through the source URLs once before submitting.

## What was done about it

| Finding | Action |
|---|---|
| W1 | Reworded honestly: the 29/29 run is dated 2026-10-09, and check 1 changed in PR #2. Its next full run waits for the test accounts' daily upload limit to reset. The redirects were checked with `curl` and a separate browser check, and testing.md records both. |
| W2, W3 | Fixed. The SQL test now gives A a document, a focus row and a storage file as the admin role inside the transaction, then confirms each exists (`setup: … > 0`) before B's attempts, and checks "after: A's document / file still there". Deleting storage rows with SQL is blocked by Supabase for everyone, so that one check was dropped and the docs explain why. |
| W4 | Fixed. The two refused checks are now labelled "(no grant)" / "(no grant on user_id)". RLS is tested separately by B's update and delete on A's rows (0 rows affected). testing.md explains which check proves what. |
| W5 | Fixed: only `insufficient_privilege` counts as refused; any other error stops the script. |
| W6 | Fixed in README and `docs/openrouter-multimodal.md`: "best-effort page count", with its limit explained. |
| W7 | Fixed in CLAUDE.md: the full list of stored fields, plus the upload counter row. |
| W8 | Checked: `npx supabase migration list` shows all 14 migrations recorded both locally and remotely, so `db push` is the right flow and the docs stay. |
| S1 | Fixed: setup checks that both users exist and that B is signed in as B; the header now says "changes nothing (rolled back)". |
| S2 | Fixed: testing.md uses `<ref>`. |
| S3 | Comment moved to the `readUsage` call; testing.md notes the cost display will be confirmed on the next real upload. |
| S4, S5 | Fixed in the README. |
| S6 | Fixed: the upload note now lists JPG, PNG, WebP or HEIC. |
| S7 | Done: all four OpenRouter URLs and both Supabase URLs were fetched on 2026-10-10 and resolve to the cited pages. |

Re-run after the fixes: the privacy SQL passes 16/16 checks, and a follow-up query found no test document or file left behind.
