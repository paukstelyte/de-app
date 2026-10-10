# Supabase schema

Word content (nouns, rules, levels) is **not** in the database. It's static JSON in `lib/flashcards/data/` and the same for everyone. The database only stores what users do.

## `public.attempts`

One row per answer a logged-in user gives, for every topic. Stats, trouble words and "Practise my mistakes" are all derived from it. Migrations: `20261005120000_create_attempts.sql` (table and RLS) and `20261005150000_harden_attempts.sql` (limits, rate limit, privileges).

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` identity | Primary key |
| `user_id` | `uuid` | Defaults to `auth.uid()`; references `auth.users` **on delete cascade** |
| `topic` | `text` | e.g. `articles`; one value per grammar topic |
| `item_id` | `text` | Id within the topic's built-in data, e.g. `seed-12`. These ids are frozen: never renumber them. |
| `answer` | `text` | What the user picked, e.g. `die` |
| `correct` | `boolean` | Decided **on the server** (`app/articles/actions.ts`), never trusted from the browser |
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

The usage columns power the model and cost line on each document card (migration `20261010120000`). Authenticated users have insert on them too (a user calling the API directly could write odd values to their own rows), so they are display-only and never used for billing or limits. There is still no update grant.

Index: `(user_id, created_at desc)`. Limit: at most **200 documents per user**; the `learning_documents_limit` BEFORE INSERT trigger raises `P0001` ("Document limit reached"), also for direct API inserts.

### `public.learning_focus`

The learner's manual focus overrides. One row per user and topic; primary key `(user_id, topic_slug)`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | Defaults to `auth.uid()`; references `auth.users` **on delete cascade** |
| `topic_slug` | `text` | Lowercase kebab-case, at most 64 characters |
| `kind` | `text` | `added` or `removed` |
| `updated_at` | `timestamptz` | Defaults to `now()` |

The update grant includes `topic_slug` because the app upserts with `on_conflict=user_id,topic_slug`, and PostgREST's `ON CONFLICT DO UPDATE` sets every payload column. RLS still pins rows to the caller, and `user_id` stays non-updatable.

### `public.learning_upload_usage`

One row per upload, used only by `use_upload_quota()`. RLS is on, there are no policies and no privileges for `anon` or `authenticated`, so the API cannot read or write it.

`public.use_upload_quota()` (security definer, callable by `authenticated` only) records an upload for `auth.uid()` and raises `P0001` ("Upload limit reached") at **10 uploads per user and 100 uploads for everyone per rolling 24 hours**. An advisory lock keeps concurrent calls from overshooting. It raises `42501` when not logged in. Each call also deletes rows older than 2 days, so the table stays small (migration `20261010130000`; the limits only look at the last 24 hours).

### Access rules

| Who | `learning_documents` | `learning_focus` | `learning_upload_usage` |
|---|---|---|---|
| Signed out (`anon`) | ❌ no privileges | ❌ no privileges | ❌ no privileges |
| Logged in (`authenticated`) | select and delete own rows; insert own rows (`title`, `extracted_text`, `no_grammar`, `suggestions` only); no update | select and delete own rows; insert (`topic_slug`, `kind`, `updated_at`); update (`topic_slug`, `kind`, `updated_at`) on own rows | ❌ only through `use_upload_quota()` |
| Server admin key | ✅ (bypasses RLS) | ✅ | ✅ |

### Storage bucket `learning-uploads`

Private. Holds files only in transit: the server reads an upload and deletes it right away.

- Size limit 10 MB (`10485760` bytes).
- Allowed types: PDF, DOCX, JPEG, PNG, WebP, HEIC, HEIF.
- Policies on `storage.objects` (insert, select, delete), all `to authenticated`: a user may only touch objects under the folder named after their own id, `<user id>/…`. There is no update policy.
- **Pending migration `20261010110000` (not yet applied):** tightens the insert policy so a new object must also match the path shape the server accepts (`<user id>/<batch id>/<digit>.<allowed ext>`) and the user's folder must hold fewer than 5 objects (counted by a new security definer function `public.learning_upload_count()`, since a policy can't query its own table). The app clears leftovers before each upload and on account deletion.

## Removed: the AI chat and its notes vector store

The AI tutor chat (`chat_usage`, `chat_messages`, `use_chat_quota`, `save_chat_turn`) and the notes vector store built for it (`notes`, `documents`, `note_save_usage`, `match_documents`, `save_note_with_chunks`, `use_note_quota`, their limit triggers, and the `vector` extension) were removed on 2026-10-09 by `20261009120000_remove_chat.sql`. Their original migrations stay in `supabase/migrations/` as history.

## Rules for every new table

1. `alter table … enable row level security;` plus policies written `to authenticated`.
2. `revoke all on <table> from anon;`, and `grant` `authenticated` only what the app uses. New tables, sequences and functions start with **no** privileges for `anon` or `authenticated` (default privileges, `20261007120000_close_default_privileges.sql`), so a table nobody granted is unusable rather than wide open. Still revoke explicitly. Never grant `truncate`: it ignores RLS.
3. A DELETE or UPDATE with no matching policy **succeeds with 0 rows changed** instead of erroring, so check affected rows when it matters.

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
