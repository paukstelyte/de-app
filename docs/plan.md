# DE-app: accounts, personal stats, "practise my mistakes"

## Context
DE-app (copy of Sprint1 die-der-das, now `Sprint 3/DE-app`) is a der/die/das flashcard game with everything in localStorage. It is becoming a **public** multi-topic German grammar trainer (A1–B2). Future topics: cases, verb conjugation, prepositions+case, possessive pronouns. Logged-in users track their own learning and redo their own mistakes. Hosting on Vercel comes after this plan.

### Decisions settled in the grilling session
| Topic | Decision |
|---|---|
| Audience | Public → email confirmation + forgot password + delete account in v1 |
| Login | Email+password **and** Google |
| Guests | Can play; keep today's behaviour (round score, round recap, "missed 2× in a row" in browser). No stats page; "Log in to track progress" prompts |
| Guest → account | Start fresh, no migration |
| Follow-up exercise | "Practise my mistakes" round across visits. AI-generated practice maybe later |
| Trouble word leaves list | After 2 correct answers in a row |
| Stats | Overall accuracy, accuracy per der/die/das, trouble-words list, accuracy per rule |
| Card editing | **Removed**. Built-in 996 words only, same for everyone |
| Levels | A1–B2 on every word **now**: Goethe A1/A2/B1 lists first, Claude assigns leftovers, user reviews |
| Level in practice | Pick level before a round (A1 / up to A2 / up to B1 / all), last choice remembered |
| Layout | Light topic picker now, der/die/das = only tile; stats grouped by topic |
| Supabase | New dedicated project (pause supabase-test if free-tier limit hit) |
| GitHub | New repo just for DE-app; no submission-repo mirroring |

Facts checked: all 996 seed cards' `rule` text matches exactly one `rules.json` description → `ruleId` is a free mechanical backfill. Seed ids are index-based (`seed-${i}`, `lib/flashcards/storage.ts:16-29`) — must be frozen into the JSON before history references them.

## Data model
- **Word content stays static in code** (`seed.json`, `rules.json`) — read-only for everyone, no DB table needed.
  `seed.json` entries gain: `id` (frozen `seed-N`), `ruleId`, `level` ("A1"|"A2"|"B1"|"B2").
- **One Supabase table, `attempts`** — generic for every future topic:
  `id bigint identity, user_id uuid not null default auth.uid() references auth.users on delete cascade, topic text not null, item_id text not null, answer text not null, correct boolean not null, created_at timestamptz default now()`, index on `(user_id, topic, created_at)`.
  RLS: select + insert `to authenticated` using `(select auth.uid()) = user_id`; no update/delete policies (history is append-only; account deletion cascades). Revoke anon access (notes-app lessons: `20260923130000_wrap_auth_uid_in_select.sql`, `20260924120000_revoke_anon_table_access.sql`, `20260925120000_revoke_anon_default_privileges.sql`).
- Stats and trouble list are **derived from `attempts`** in a pure TS function — no extra tables.
  Trouble word = has ≥1 wrong attempt AND its last 2 attempts are not both correct.
  `ponytail:` computed in app from all of a user's rows for the topic; move to a SQL view/RPC if history grows into tens of thousands of rows.
- Level choice: localStorage (works for guests and logged-in alike; per-browser).

## Phases

### 0. Repo + project hygiene
- `git init` in DE-app, new GitHub repo (user creates on GitHub, we push). Ensure `.gitignore` covers `.env*.local`.
- Rewrite `CLAUDE.md`: stack now Next.js + TS + Tailwind 4 + Supabase (auth + Postgres); localStorage only for guest/browser prefs; card CRUD requirements removed; mirroring rule removed; keep design tokens + game interaction rules. This plan = approval to install `@supabase/ssr` and `@supabase/supabase-js`.
- Note: `AGENTS.md` — read `node_modules/next/dist/docs/` before Next 16-specific code (proxy.ts etc.).

### 1. Word data: ids, ruleId, levels
- `scripts/` (committed this time — CLAUDE.md records the lost pipeline):
  - `add-ids-and-rules.mjs`: writes frozen `id` + `ruleId` into `seed.json`.
  - `levels/`: user downloads Goethe A1, A2, B1 Wortliste PDFs → extract nouns to text → `assign-levels.mjs` sets lowest matching level; unmatched → `levels-review.csv` with Claude's proposed level (filled in-session, no API) → user reviews CSV → script writes `level` into `seed.json`.
- Update `lib/flashcards/types.ts`: drop `origin`/"new" status/`FlashcardInput`; add `ruleId`, `level`.

### 2. Restructure: topic picker, remove card editing, level picker
- `lib/topics.ts`: array with one entry `{ slug: "articles", title: "der · die · das", href: "/articles" }`.
- `app/page.tsx` → topic picker tiles. Current game moves to `app/articles/page.tsx`; `/rules` stays.
- Delete `app/cards/**`, `components/FlashcardForm.tsx`, `lib/flashcards/export.ts`, and Print/CSV pieces only used by `/cards`; strip `addCard/updateCard/deleteCard` from `lib/flashcards/context.tsx`; `NavBar` links updated. Simplify `storage.ts` to persist only `{ [cardId]: incorrectStreak }` for guests (drop the `origin` backfill migration).
- Level selector above the game; `buildPracticeOrder` (`lib/flashcards/practice.ts`) filters by level; "new" bucket removed.

### 3. Supabase auth (copy from `Sprint2/notes-app`, adapt to Tailwind 4 / DE-app styling)
- Copy: `lib/supabase/{client,server,proxy}.ts`, root `proxy.ts` (keep the explicit static-file matcher), `app/auth/{confirm,callback}/route.ts`, `app/auth/{sign-up,sign-up-success,forgot-password,update-password,error}`, `app/login`, `components/{login-form,sign-up-form,forgot-password-form,update-password-form,auth-button,logout-button,google-icon}.tsx`, `safeRedirectPath` from `lib/utils.ts`.
- Change proxy redirect rule: public = `/`, `/articles`, `/rules`, `/login*`, `/auth*`; protected = `/progress`, `/account`.
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server-only, phase 6).
- Manual (user, guided): create Supabase project; enable Google provider (Google Cloud OAuth client); set Site URL + redirect URLs for localhost (Vercel URLs added in hosting step).
- `AuthButton` in `NavBar`.

### 4. Record answers
- Migration `supabase/migrations/<ts>_create_attempts.sql` (table + RLS + revokes above); generate `lib/database.types.ts`.
- Server action `recordAttempt(topic, itemId, answer, correct)` in `app/articles/actions.ts`.
- `usePracticeSession.choose` (`lib/flashcards/usePracticeSession.ts`) gets the recorder injected: guest → existing localStorage streak; logged-in → server action (fire-and-forget with error toast/log, game never blocks).
- Logged-in round ordering: `app/articles/page.tsx` (server wrapper) fetches the user's trouble ids and passes them in; trouble words go first instead of localStorage streak.

### 5. Progress page + "Practise my mistakes"
- `lib/progress.ts`: pure `summarize(attempts, cards)` → `{ overall, byArticle, byRule, trouble[] }`, plus `lib/progress.test.ts` (one assert-based test via `node --test`; covers trouble-list 2-in-a-row rule and accuracy math).
- `app/progress/page.tsx` (protected, server component): sections per topic (one today): overall %, der/die/das bars, accuracy per rule (link to `/rules#id`), trouble words list, button "Practise my mistakes (N)".
- `/articles?mode=mistakes` builds a round (≤30) from trouble ids only; end-of-round shows how many left the list. Guests see a "Log in to track your progress" prompt in place of the progress link.

### 6. Account deletion
- `app/account/page.tsx` (protected): email shown, "Delete my account" with typed confirmation.
- Server action uses `SUPABASE_SECRET_KEY` admin client → `auth.admin.deleteUser(uid)`; `attempts` cascades; sign out + redirect home.

### 7. Docs
- `README.md`: what it is, setup (env vars, Supabase migrations, Google provider), run/test commands.
- `docs/supabase-schema.md`: `attempts` table, RLS, the anon-revoke rule for every future table.
- Future topic recipe in CLAUDE.md: add item data file + `lib/topics.ts` entry + reuse `attempts` with a new `topic` value.

## Before going public (with the Vercel step)
- Google Cloud "DE-app": publish the OAuth app (Audience → Publish app; needs home page + privacy policy links on Branding) — until then only listed test users can use Google login. Add the production URL as a JavaScript origin if Google's own sign-in button is ever used.
- Custom SMTP provider (Supabase's built-in sender is rate-limited and free-tier projects can't edit email templates without one).
- Then switch confirmation/recovery emails to `token_hash` links handled by a `/auth/confirm` route (see notes-app), so links work on any device.

## Out of scope (later)
Vercel hosting (next step), AI-generated exercises, progress-over-time charts/streaks, guest-progress migration, other topics' content, levels per user profile.

## Verification
- `npm run lint` and `npm run build` clean after each phase.
- `node --test lib/progress.test.ts` passes (check Node version supports TS type-stripping; else `.mjs`).
- Data script check: every seed card has `id`, `ruleId` ∈ rules, `level` ∈ A1–B2 (one-line node assert).
- Manual end-to-end via Playwright CLI on `localhost:3000`: guest plays a round (no stats page, prompt shown) → sign up with email → confirm → play, miss words → `/progress` shows accuracy + trouble words → "Practise my mistakes" → answer a word right twice → it leaves the list → Google login works → delete account → login fails.
- RLS check (SQL shown alongside results): as user B, `select * from attempts` returns none of user A's rows; as anon, `select`/`insert` on `attempts` is denied; run `security-auditor` agent before hosting.
