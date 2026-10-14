# Supabase schema

Word content (nouns, rules, levels) is **not** in the database. It's static JSON in `lib/flashcards/data/` and the same for everyone. The database only stores what users do.

## `public.attempts`

One row per answer a logged-in user gives, for every topic. Stats, trouble words and "Practise my mistakes" are all derived from it. Migrations: `20261005120000_create_attempts.sql` (table and RLS), `20261005150000_harden_attempts.sql` (limits, rate limit, privileges) and `20261014100000_attempts_client_id.sql` (answer ids).

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` identity | Primary key |
| `user_id` | `uuid` | Defaults to `auth.uid()`; references `auth.users` **on delete cascade** |
| `topic` | `text` | e.g. `articles`; one value per grammar topic |
| `item_id` | `text` | Id within the topic's built-in data, e.g. `seed-12`. These ids are frozen: never renumber them. |
| `answer` | `text` | What the user picked, e.g. `die` |
| `correct` | `boolean` | Decided **on the server** (`app/articles/actions.ts`, `app/topics/[slug]/practice/actions.ts`), never trusted from the browser |
| `client_id` | `uuid`, nullable | The id the browser gave this answer. A retried save sends the same id; the unique index `(user_id, client_id)` refuses the copy (`23505`), which the server treats as "already saved", so an answer is never counted twice. Older rows have none (NULLs don't clash) |
| `created_at` | `timestamptz` | Defaults to `now()` |

Index: `(user_id, topic, created_at)`, which matches how the app reads a user's history.

Limits. A logged-in user can bypass the app and call the database API directly, so the table bounds what one user can write:
- `topic` is 1–32 characters; `item_id` and `answer` are 1–64 characters (check constraints).
- At most **120 inserts per user per minute**: the `attempts_rate_limit` BEFORE INSERT trigger raises `P0001`. It also caps a single bulk insert, because row triggers see earlier rows of the same statement.
- Such a user can still fake *their own* `correct` values; RLS keeps that confined to their own stats.

### Access rules

| Who | select | insert | update / delete |
|---|---|---|---|
| Signed out (`anon`) | ❌ no table privileges at all | ❌ | ❌ |
| Logged in (`authenticated`) | ✅ own rows only | ✅ own rows only | ❌ privileges revoked (and no policy) |
| Server admin key | ✅ (bypasses RLS) | ✅ | ✅. Only used to delete a user. |

- Policies use `(select auth.uid()) = user_id`. Wrapping it in `select` means it's evaluated once per query, not once per row.
- History is append-only. Deleting an account (`app/account/actions.ts` → `auth.admin.deleteUser`) removes the user's rows through the cascade.

## Customized Learning

Migration: `20261010100000_customized_learning.sql`. Three tables and one storage bucket. Topic slugs refer to the static topic list in code, not to a table.

### `public.learning_documents`

A saved upload: its extracted text and the AI's topic suggestions.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` identity | Primary key |
| `user_id` | `uuid` | Defaults to `auth.uid()`; references `auth.users` **on delete cascade** |
| `title` | `text` | 1–80 characters |
| `extracted_text` | `text` | At most 8000 characters; defaults to empty |
| `no_grammar` | `boolean` | Defaults to `false` |
| `suggestions` | `jsonb` | Array of at most 6 items, e.g. `{"slug":"dative-case","reason":"…","fromMistake":false}` |
| `created_at` | `timestamptz` | Defaults to `now()` |
| `model` | `text` | OpenRouter model slug that read the document, 1–100 characters; null on rows saved before 2026-10-10 |
| `prompt_tokens` | `integer` | ≥ 0, from OpenRouter's `usage`; nullable |
| `completion_tokens` | `integer` | ≥ 0, from OpenRouter's `usage`; nullable |
| `cost_usd` | `numeric(12,8)` | 0 ≤ cost < 1, from OpenRouter's `usage.cost`; nullable |

The usage columns power the model and cost line on each document card (migration `20261010120000`). Since migration `20261012160000` users have no insert on `learning_documents` at all: the server saves each document with the admin key after a real, counted AI read (`analyseUpload`, pinned to the caller's id), so the topics and the usage figures can't be forged. The figures are still display-only. There is no update grant.

Index: `(user_id, created_at desc)`. Limit: at most **200 documents per user**; the `learning_documents_limit` BEFORE INSERT trigger raises `P0001` ("Document limit reached"), also for direct API inserts.

### `public.learning_focus`

The learner's manual focus overrides. One row per user and topic; primary key `(user_id, topic_slug)`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | Defaults to `auth.uid()`; references `auth.users` **on delete cascade** |
| `topic_slug` | `text` | Lowercase kebab-case, at most 64 characters |
| `kind` | `text` | `added` or `removed` |
| `updated_at` | `timestamptz` | Set by the database: `now()` on insert, the `learning_focus_touch` trigger on update (users can't write it, since `20261012160000`) |

The update grant includes `topic_slug` because the app upserts with `on_conflict=user_id,topic_slug`, and PostgREST's `ON CONFLICT DO UPDATE` sets every payload column. RLS still pins rows to the caller, and `user_id` stays non-updatable.

### `public.learning_upload_usage`

One row per upload, written only by `use_upload_quota()`. RLS is on. Since migration `20261012130000` a signed-in user may **read their own rows** (policy "Users read their own upload usage", `select` granted to `authenticated`); nobody can insert, update or delete through the API, and `anon` has no privileges.

`public.use_upload_quota()` (security definer, callable by `authenticated` only) records an upload for `auth.uid()` and raises `P0001` ("Upload limit reached") at **10 uploads per user and 100 uploads for everyone per rolling 24 hours**. An advisory lock keeps concurrent calls from overshooting. It raises `42501` when not logged in. Each successful call also deletes rows older than 2 days (a refused call rolls back, delete included), so the table stays small (migration `20261010130000`; the limits only look at the last 24 hours).

From migration `20261012100000`, `use_upload_quota()` returns the id of the row it recorded, and a second function, `public.upload_allowance()` (security definer, `authenticated` only, anon refused), returns the caller's `user_left`, `user_limit` (10), `shared_left` (of 100) and `next_free_at` (when the next slot frees up: 24 hours after the oldest counted upload of whichever limit is full). It exposes only the caller's own count and the shared total. The Customized Learning page shows these as "Uploads left today".

When the AI read fails with no paid answer (a network failure or an error status from OpenRouter), the server gives the upload back by deleting that row with the admin key (`giveBackUpload` in `app/learning/actions.ts`). A timeout, a cut-off or unusable answer, a failed save and a photo with no readable text are **not** given back: the AI call may already have been paid for, and giving blank photos back would let them bypass the daily limits. There is deliberately no function users can call to give an upload back.

### Access rules

| Who | `learning_documents` | `learning_focus` | `learning_upload_usage` |
|---|---|---|---|
| Signed out (`anon`) | ❌ no privileges | ❌ no privileges | ❌ no privileges |
| Logged in (`authenticated`) | select and delete own rows; no insert (the server saves documents with the admin key, since `20261012160000`); no update | select and delete own rows; insert (`topic_slug`, `kind`); update (`topic_slug`, `kind`) on own rows | select own rows only (policy since `20261012130000`); writes only through `use_upload_quota()` |
| Server admin key | ✅ (bypasses RLS) | ✅ | ✅ |

### Storage bucket `learning-uploads`

Private. Holds files only in transit: the server reads an upload and deletes it right away.

- Size limit 10 MB (`10485760` bytes).
- Allowed types: PDF, DOCX, JPEG, PNG, WebP, HEIC, HEIF.
- Policies on `storage.objects` (insert, select, delete), all `to authenticated`: a user may only touch objects under the folder named after their own id, `<user id>/…`. There is no update policy.
- The insert policy (migration `20261010110000`) also requires the path shape the server accepts (`<user id>/<batch id>/<digit>.<allowed ext>`) and fewer than 5 objects in the user's folder, counted by the security definer function `private.learning_upload_count()` (a policy can't query its own table). Since `20261012160000` the function lives in the `private` schema, which the API doesn't expose. The app clears leftovers before each upload and on account deletion.

## Removed: the AI chat and its notes vector store

The AI tutor chat (`chat_usage`, `chat_messages`, `use_chat_quota`, `save_chat_turn`) and the notes vector store built for it (`notes`, `documents`, `note_save_usage`, `match_documents`, `save_note_with_chunks`, `use_note_quota`, their limit triggers, and the `vector` extension) were removed on 2026-10-09 by `20261009120000_remove_chat.sql`. Their original migrations stay in `supabase/migrations/` as history.

## Rules for every new table

1. `alter table … enable row level security;` plus policies written `to authenticated`.
2. `revoke all on <table> from anon;`, and `grant` `authenticated` only what the app uses. New tables, sequences and functions start with **no** privileges for `anon` or `authenticated` (default privileges, `20261007120000_close_default_privileges.sql`), so a table nobody granted is unusable rather than wide open. Still revoke explicitly. Never grant `truncate`: it ignores RLS.
3. A DELETE or UPDATE with no matching policy **succeeds with 0 rows changed** instead of erroring, so check affected rows when it matters.

## Tests

`npm run test:db` runs the pgTAP tests in `supabase/tests/database/` on the throwaway local database (`npm run db:start`): privacy between two users on every table and the upload folder, the upload allowance, and answer ids. Each test file runs in a transaction that is rolled back. After a migration, also run `npm run db:types` so `lib/supabase/database.types.ts` matches the schema.

## Checking access

```sql
-- RLS on, policies, and which roles have privileges
select c.relname, c.relrowsecurity as rls_on,
  (select string_agg(polname || ' (' || polcmd::text || ')', ', ') from pg_policy where polrelid = c.oid) as policies,
  (select string_agg(distinct grantee || ':' || privilege_type, ', ')
     from information_schema.role_table_grants
     where table_name = c.relname and grantee in ('anon', 'authenticated')) as grants
from pg_class c where c.relname = 'attempts';
```

A signed-out request with the publishable key should get `permission denied for table attempts` (42501):

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/attempts?select=id" -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```
