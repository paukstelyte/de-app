# Security scan of changed files: DE-app, reviewer-feedback vs main, 2026-10-14

Scanned: the app, test and config files changed in PR #20 (commits 066fdd7..8b3221c; the 308 removed third-party skill files were left out)
Scanners: Supabase ✓, Next.js ✓, Vercel ✓
Totals: 0 critical · 1 high · 2 medium · 3 low. All fixed before merging (commits 2e11b6a and the Node pin), or handled by the deploy order.

## High
### 1. A crafted PDF could keep the server busy for minutes (flagged by: Next.js)
- Location: `lib/learning/documents.ts` `pdfPageCount`, which runs before the upload quota.
- What could go wrong: for every `stream` keyword, the counter searched back through the whole file for the object header, so the work grew with the square of the file size (1 MB: 31 s; 10 MB: an estimated 50 min).
- Fix (done): it looks back a fixed 4 KB only and refuses files with more than 20,000 streams. A regression test checks a 1 MB fake-stream file finishes in under 2 s.

## Medium
### 2. The Word zip guard could be made to unpack the same data thousands of times (flagged by: Next.js)
- Location: `lib/learning/documents.ts` `docxWithinLimits`.
- Fix (done): at most 500 entries (a .docx has 10–30), and the entries' compressed sizes may not add up to more than the file, so entries can't share and re-read the same data. New test.
### 3. Deploy order for the new `attempts.client_id` column (flagged by: Supabase)
- If the code deployed before the migration, every answer save would fail.
- Fix (done): the migration was applied to the live project before merging, and the column, unique index and insert grant were checked there.

## Low
### 4. The local-only check in the test setup could be skipped (flagged by: Supabase)
- `playwright.config.ts` checked the Supabase URL only when it read it itself. Fix (done): checked every time.
### 5. The `E2E` test switch could weaken the CSP if ever set on Vercel (flagged by: Next.js)
- Fix (done): it is ignored whenever `VERCEL` is set.
### 6. Open-ended Node version (flagged by: Vercel)
- `engines: ">=24"` would let Vercel move to the next Node major by itself. Fix (done): `24.x`, matching `.nvmrc` and the project setting.

Also noted (Next.js, low): `lib/learning/documents.ts` has no `server-only` marker. Kept as is: Node's unit tests load it, and that marker can't be resolved outside the Next.js build; it holds no secrets and only the upload action imports it (said in a comment).

**Checked and fine:** answer saves validate the client id and re-check the session, and the unique index is per user; admin-key use stays pinned to the caller; `OPENROUTER_BASE_URL` only accepts a local address; prompt and document are separate and the output is schema-checked and rendered as plain text; type-only imports from server-only modules; no new `NEXT_PUBLIC_` variables; none of the test-only variables is set on Vercel; both secrets are Sensitive and Production-only; no secrets or env files in the branch's commits; RLS, policies and grants on `attempts` unchanged apart from the new column grant.

**Not checked:** headers from the new build (the preview needs a Vercel login; check production after the merge).
