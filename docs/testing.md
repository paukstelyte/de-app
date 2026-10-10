# Testing

How DE-app is tested, and the latest results. Commands are run from the repo root.

## Summary

| Suite | What it covers | Latest result |
|---|---|---|
| `npm test` | Unit tests: upload rules, AI answer parsing, Word reader (incl. zip-bomb cap), focus list, usage display, answer checking, and validation of all 81 exercise files | **129 / 129 pass** (2026-10-10) |
| `supabase/tests/cross-user-privacy.sql` | Database: a signed-in user can't reach another user's AI outputs, focus list, answers or upload files | **All checks pass** (2026-10-10) |
| `bash e2e/learning.sh` | Browser, real AI call: login redirect, PDF / HEIC / Word / blank-photo uploads, files deleted after reading, focus, delete, second user isolation | **PASS, 29/29 checks** (2026-10-09; needs 4 of the test account's 10 daily uploads) |
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

PR #1 added a manual real-upload check of the model and cost display. The upload box named `google/gemini-2.5-flash-lite`. The card showed "Read by Gemini 2.5 Flash Lite · 3,406 tokens · about $0.0004". The saved row held 3,169 prompt and 237 completion tokens and $0.0004117.

## Signed-out lockout

- `/learning`, `/learning/practice`, `/progress` and `/account` redirect signed-out visitors to `/login?next=…`. This is done by `lib/supabase/proxy.ts`, plus a guard in each page.
  - `curl` without a session: `/learning` → `307 /login?next=%2Flearning`; `/learning/practice` → `307 /login?next=%2Flearning%2Fpractice`.
  - `e2e/learning.sh` check 1 tests both in a real browser.
- Every server action checks the session itself, so calling an action directly without logging in does nothing.
- Signed-out visitors (the `anon` role) have no grants on any user-data table, so the database refuses them even outside the app.

## Cross-user privacy (bonus)

Two independent checks show one learner's AI context can't be reached by another.

**1. Browser:** `e2e/learning.sh` check 8. User A uploads documents and changes their focus list. User B then logs in and sees none of A's documents and an empty focus list.

**2. Database:** `supabase/tests/cross-user-privacy.sql` runs inside a transaction that is rolled back, so it changes nothing. As the admin role it first confirms A really has data. Then it acts as B (`role authenticated`, B's JWT) and tries to reach it.

```bash
npx supabase db query --linked --project-ref cenzahkgbbnmgzikxvsz -f supabase/tests/cross-user-privacy.sql
```

Result on 2026-10-10:

| Check | Expected | Result |
|---|---|---|
| A has saved answers (admin view) | > 0 | 80 |
| A has focus rows (admin view) | > 0 | 2 |
| Documents saved by users other than B (admin view) | any | 1 |
| B reads other users' documents (AI outputs) | 0 | 0 |
| B reads other users' focus lists | 0 | 0 |
| B reads A's answers | 0 | 0 |
| B reads the upload counter | refused | refused 42501 |
| B lists files in other users' upload folders | 0 | 0 |
| B deletes A's documents | 0 | 0 |
| B adds to A's focus list | refused | refused 42501 |

Earlier rolled-back SQL tests (run when the migrations were applied) also showed:

- a user can't save a document under someone else's account (42501);
- the 11th upload in a day is refused (P0001);
- uploading into another user's storage folder is refused (42501);
- a 6th file in a folder is refused (42501).

## Security scans

Each feature branch was scanned with `/security-scan-changed`, and the whole project with `/security-scan`. Each scan runs three scanner agents: Supabase, Next.js and Vercel. The latest scans found no critical, high or medium issues. They checked:

- `OPENROUTER_API_KEY` and `SUPABASE_SECRET_KEY` are read only in server code;
- no secrets are in the git history;
- the only `NEXT_PUBLIC_` values are the Supabase URL and publishable (anon) key;
- RLS is on for every table, with owner-only policies.
