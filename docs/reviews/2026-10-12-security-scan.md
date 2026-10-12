# Full security scan: DE-app, 2026-10-12

`/security-scan` with the Supabase, Next.js and Vercel scanners (read-only; the live database was checked with `select` queries only).
Totals: 0 critical · 0 high · 2 medium · 11 low. What happened to each finding is in the last column.

| # | Severity | Finding (flagged by) | Outcome |
|---|---|---|---|
| 1 | Medium | An upload was given back even when OpenRouter had already charged (timeout, cut-off or unusable answer), so a long document could trigger paid calls without using the daily limits (Next.js) | **Fixed:** only a network failure or an error status gives the upload back (`lib/learning/analyse.ts`, `app/learning/actions.ts`) |
| 2 | Medium | The test account password is in the public git history (commits `0bb0673`, `e544f7d`) (Vercel) | Owner's decision: the owner chose on 2026-10-06 to keep the test accounts as they are |
| 3 | Low | Logged-in users can insert `attempts.correct` themselves (Supabase) | Accepted: only their own stats change; the fix would need the admin key on every answer save |
| 4 | Low | Users can insert `learning_documents` directly, skipping the quota and the AI (Supabase, Next.js) | **Fixed:** the server saves documents with the admin key; insert revoked (migration `20261012160000`) |
| 5 | Low | Users can set `learning_focus.updated_at` (Supabase) | **Fixed:** set by the database (default and trigger); column grants revoked |
| 6 | Low | Leftover grants on `attempts_id_seq` (Supabase) | **Fixed:** revoked |
| 7 | Low | `supabase_admin` default privileges in `public` are open (Supabase) | No change possible (platform default); install extensions into `extensions` |
| 8 | Low | `learning_upload_count()` is a security definer function in the API-exposed schema (Supabase) | **Fixed:** moved to the `private` schema, storage policy updated |
| 9 | Low | The auth redirect list includes `localhost:3000` (Supabase) | Kept: needed for local development, one `config.toml` for both |
| 10 | Low | Data access scattered; the admin client built in two places (Next.js) | **Fixed:** one server-only `lib/supabase/admin.ts`, used by all three admin uses |
| 11 | Low | Several accounts could use up the shared 100-a-day upload limit (Next.js) | Accepted as the cost ceiling; a sign-up CAPTCHA would raise the bar |
| 12 | Low | CSP allows inline scripts (Vercel) | Kept: deliberate (nonces would make every page dynamic) |
| 13 | Low | Server secrets exist only in Production (Vercel) | Kept: intended; never copy production keys to Preview |

Checked and fine (summary): RLS on all four tables, owner-scoped policies, `anon` has no access; security definer functions use `auth.uid()` and an empty `search_path`; the bucket is private and folder-scoped; secret keys only in server code; no secrets in git history or the live JavaScript; Vercel Sensitive flags, Deployment Protection and security headers in place; the live database matched all 17 migrations.
