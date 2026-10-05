# DE-app

A German grammar trainer (A1–B2). The first topic is **der · die · das**: guess a noun's article, then see the rule and any exception behind it.

- **Guests** can play straight away. Progress is kept only in that browser.
- **Logged-in users** get every answer saved, a progress page (overall accuracy, accuracy per article and per rule, trouble words) and a **Practise my mistakes** round. A trouble word leaves the list after 2 correct answers in a row.

Built with Next.js (App Router), TypeScript, Tailwind CSS 4 and Supabase (auth + Postgres).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys | Safe in the browser |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys | **Server-only**, used by "Delete my account". Never prefix with `NEXT_PUBLIC_`. |

### Database and auth settings

The schema lives in `supabase/migrations/` and the auth settings (site URL, redirect URLs, password length) in `supabase/config.toml`. With the Supabase CLI logged in (`npx supabase login`, run in a real terminal):

```bash
# apply a migration
npx supabase db query --linked --project-ref <ref> -f supabase/migrations/<file>.sql
# push auth settings after editing config.toml
npx supabase config diff --project-ref <ref>
npx supabase config push --project-ref <ref>
```

Table design and access rules: [`docs/supabase-schema.md`](docs/supabase-schema.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Progress/trouble-word logic tests (`lib/*.test.mjs`, Node's built-in test runner) |

## Project layout

| Path | What's there |
|---|---|
| `app/page.tsx` | Topic picker (`lib/topics.ts` lists the topics) |
| `app/articles/` | der/die/das game page and the `recordAttempt` server action |
| `components/ArticlesGame.tsx` | The game UI; round logic in `lib/flashcards/usePracticeSession.ts` |
| `app/progress/` | Progress page; stats come from `lib/progress.ts` |
| `app/account/` | Log out and delete account |
| `app/login`, `app/auth/*` | Login, sign-up, password reset, OAuth/email callback |
| `lib/supabase/` | Browser, server and proxy Supabase clients; `proxy.ts` protects `/progress` and `/account` |
| `lib/flashcards/data/` | Built-in words (`seed.json`) and rules (`rules.json`) |
| `scripts/` | One-off data scripts (word ids/rules, A1–B2 levels from the Goethe word lists) |

## Adding a grammar topic

1. Add its built-in items (each with a stable, never-reused `id`) and a page under `app/<topic>/`.
2. Add an entry to `lib/topics.ts`.
3. Save answers to the existing `attempts` table with a new `topic` value. No new table is needed.

## Known limits

- Supabase's built-in email sender is rate-limited, and on the free plan the email templates can't be edited without your own email service (SMTP). Until one is set up, confirmation and password-reset links only log you in if they're opened in the same browser (see `docs/plan.md`).
- Stats are computed from a user's whole answer history on each page load. That's fine for thousands of answers; move it into SQL if histories get much larger.
