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

## Rules for every new table

1. `alter table … enable row level security;` plus policies written `to authenticated`.
2. `revoke all on <table> from anon;`, and grant `authenticated` only what the app uses. The project's default privileges are also set so that new tables, sequences and functions start closed to `anon`, but revoke explicitly anyway.
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
