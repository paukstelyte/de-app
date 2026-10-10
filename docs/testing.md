# Testing

How DE-app is tested, and the latest results. Commands are run from the repo root.

## Summary

| Suite | What it covers | Latest result |
|---|---|---|
| `npm test` | Unit tests: upload rules, AI answer parsing, Word reader (incl. zip-bomb cap), focus list, usage display, answer checking, and validation of all 81 exercise files | **129 / 129 pass** (2026-10-10) |
| `supabase/tests/cross-user-privacy.sql` | Database: a signed-in user can't read, change or delete another user's AI outputs, focus list, answers or upload files | **16/16 checks pass** (2026-10-10) |
| `bash e2e/learning.sh` | Browser, real AI call: login redirect, PDF / HEIC / Word / blank-photo uploads, files deleted after reading, focus, delete, second user isolation | **PASS, 29/29 checks** on 2026-10-09. Check 1 was changed on 2026-10-10 (PR #2) to the login redirects; that new version hasn't had a full run yet, because both test accounts used their daily uploads. The redirects themselves were checked with curl and a separate browser check (below). |
| Live upload check (production) | 1 PDF and 5 photos through the live site after the 5-file folder cap went live; storage empty afterwards | **PASS** (2026-10-09) |
| `bash e2e/exercises.sh` | Browser, no AI: practice pages, guest round, mistakes replay, answers saved when logged in, accuracy shown, phone width, keyboard | **PASS, 27/27 checks** (2026-10-10) |
| `bash e2e/all-practice-pages.sh` | Browser: all 81 practice pages show their first question with no console errors | **PASS, 81/81** (2026-10-10, local; also passed on the live site 2026-10-09) |

Browser checks use the global `playwright-cli` against `BASE` (default `http://localhost:3000`). Test accounts come from environment variables, never from the repo; see [`e2e/README.md`](../e2e/README.md).

## The AI feature's happy path

`e2e/learning.sh` logs in, uploads `e2e/fixtures/lektion7.pdf` (a worksheet on dative prepositions), and waits for the real Gemini call. It checks that:

- the document appears with a title about Lektion 7 / Präpositionen;
- its topics include `prepositions-dative` or `dative-case`;
- *Your focus now* lists them;
- the upload folder in Supabase Storage is empty afterwards.

The HEIC photo and the Word file give the same topics. A blank image gives "No German grammar topics found" and no invented text.

PR #1 added a manual real-upload check of the model and cost display (before PR #3 removed the deprecated `usage: { include: true }` request option; OpenRouter documents usage as always included, so the display is unchanged, and the next real upload will confirm it). The upload box named `google/gemini-2.5-flash-lite`. The card showed "Read by Gemini 2.5 Flash Lite · 3,406 tokens · about $0.0004". The saved row held 3,169 prompt and 237 completion tokens and $0.0004117.

## Signed-out lockout

- `/learning`, `/learning/practice`, `/progress` and `/account` redirect signed-out visitors to `/login?next=…`. This is done by `lib/supabase/proxy.ts`, plus a guard in each page.
  - `curl` without a session: `/learning` → `307 /login?next=%2Flearning`; `/learning/practice` → `307 /login?next=%2Flearning%2Fpractice`.
  - In a real browser (playwright-cli, 2026-10-10), a signed-out visit to `/learning/practice` landed on the login page, and after logging in the Practise my focus round worked and saved an answer. `e2e/learning.sh` check 1 now asserts both redirects; see the note in the summary about its next full run.
- Every server action checks the session itself, so calling an action directly without logging in does nothing.
- Signed-out visitors (the `anon` role) have no grants on any user-data table, so the database refuses them even outside the app.

## Cross-user privacy (bonus)

Two independent checks show one learner's AI context can't be reached by another.

**1. Browser:** `e2e/learning.sh` check 8. User A uploads documents and changes their focus list. User B then logs in and sees none of A's documents and an empty focus list.

**2. Database:** `supabase/tests/cross-user-privacy.sql` runs in one transaction that is rolled back, so it changes nothing.

- **Setup.** As the admin role it gives user A a saved document, a focus row and an uploaded file, so every check has something to find, and confirms A also has saved answers.
- **Attempts.** It then acts as user B (`role authenticated`, B's JWT) and tries to reach A's data.
- **Pass rule.** Only permission errors count as "refused"; any other error stops the script.

```bash
npx supabase db query --linked --project-ref <ref> -f supabase/tests/cross-user-privacy.sql
```

Result on 2026-10-10:

| Check | Expected | Result |
|---|---|---|
| setup: both test users exist | yes | yes |
| setup: A has documents | > 0 | 2 |
| setup: A has focus rows | > 0 | 3 |
| setup: A has saved answers | > 0 | 80 |
| setup: A has an uploaded file | > 0 | 1 |
| B is signed in as B | yes | yes |
| B reads A's documents (AI outputs) | 0 | 0 |
| B reads A's focus list | 0 | 0 |
| B reads A's answers | 0 | 0 |
| B lists A's uploaded files | 0 | 0 |
| B changes A's focus list (RLS on update) | 0 | 0 |
| B deletes A's documents (RLS on delete) | 0 | 0 |
| B reads the upload counter (no grant) | refused | refused 42501 |
| B writes a row tagged with A's id (no grant on user_id) | refused | refused 42501 |
| after: A's document still there | 1 | 1 |
| after: A's uploaded file still there | 1 | 1 |

What each kind of check shows:

- **The "0" rows** are row-level security at work: the rows exist, but B's queries never see or touch them.
- **The two "refused" rows** come from grants. Users have no access to the upload counter at all, and no permission to set `user_id`, so a row can't even be written under someone else's name.
- **File deletes** can't be tested in SQL, because Supabase blocks deleting storage rows with SQL for everyone. They go through the Storage API, where the same own-folder policy applies, which is covered by the browser checks. Afterwards, no test document or file remained in the database.

Earlier rolled-back SQL tests, run when the migrations were applied, also showed four refusals:

- a document can't be saved with someone else's `user_id`;
- the 11th upload in a day is refused (P0001);
- uploading into another user's storage folder is refused (42501, storage policy);
- a 6th file in a folder is refused (42501).

## Security scans

Each feature branch was scanned with `/security-scan-changed`, and the whole project with `/security-scan`. Each scan runs three scanner agents: Supabase, Next.js and Vercel. The latest scans found no critical, high or medium issues. They checked:

- `OPENROUTER_API_KEY` and `SUPABASE_SECRET_KEY` are read only in server code;
- no secrets are in the git history;
- the only `NEXT_PUBLIC_` values are the Supabase URL and publishable (anon) key;
- RLS is on for every table, with owner-only policies.
