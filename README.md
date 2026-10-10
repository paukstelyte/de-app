# DE-app

**Upload what you're learning in German class, and get your own grammar practice plan.**

Live: https://de-app-six.vercel.app

## What it does

1. **Customized Learning** (`/learning`, logged in). Upload a worksheet, textbook page, typed notes or homework: one PDF (up to 20 pages), one Word file, or up to 5 photos (JPG, PNG, WebP, HEIC), 10 MB each. An AI model reads it and picks the 3–6 grammar topics it practises from a fixed catalogue of 82 A1–C2 topics, mistakes first, each with a reason quoting your document. The result is saved, and the original file is deleted straight after reading.
2. **Your focus now.** The topics from your uploads of the last 30 days, ranked by mistakes and how often they come up, with your progress on each. Remove a topic, or add one from any topic page.
3. **Practise my focus** (`/learning/practice`). One mixed round of exercises from exactly your focus topics.
4. **Grammar Topics** (`/topics`, open to everyone). The 82-topic catalogue. Each topic has a practice page with 30 checked exercises (pick the answer, type the word, put the words in order), rounds of 10, an explanation after each answer, and "Practise my mistakes". The practice pages are labelled "still in test mode".
5. **der · die · das** (`/articles`). The original flashcard game for noun gender: about 1,000 A1–B2 nouns, every answer explained by its rule.

**Why AI is the core.** The catalogue and exercises are generic. The AI is what connects them to *your* lessons: it reads your own material and decides what you should practise now. Without it the app wouldn't know what you're learning.

Guests can browse topics and practise without saving. Signed-out visitors who open Customized Learning, Progress or Account are sent to the login page.

## The AI feature

| | |
|---|---|
| Model | `google/gemini-2.5-flash-lite` via [OpenRouter](https://openrouter.ai) (shown in the app as "Gemini 2.5 Flash Lite") |
| Where the call happens | `lib/learning/analyse.ts` (server-only), called from the server action in `app/learning/actions.ts` |
| Input | PDF as a `file` part with the `file-parser` plugin set to the `native` engine; photos as base64 `image_url` parts; Word files read by a small built-in reader and sent as text |
| Output | Strict JSON schema (`lib/learning/suggestions.ts`): title, the text read, "no grammar" flag, topics with reasons. Topics outside the catalogue are dropped |
| Cost | About $0.0004 per document. Each document card shows the model, tokens and cost from OpenRouter's response |
| Limits | 10 uploads a day per learner, 100 a day for everyone, 200 saved documents per learner, at most 5 files in a learner's upload folder (all enforced by the database) |

Details and the OpenRouter references: [`docs/openrouter-multimodal.md`](docs/openrouter-multimodal.md).

Built with Next.js (App Router), TypeScript, Tailwind CSS 4, Supabase (auth, Postgres with row-level security, Storage) and OpenRouter, deployed on Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Public by design |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys | The publishable (anon) key; safe in the browser, row-level security protects the data |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys | **Server-only**, used only by "Delete my account" (`app/account/actions.ts`). Never prefix with `NEXT_PUBLIC_` |
| `OPENROUTER_API_KEY` | OpenRouter → Keys | **Server-only**, used only in `lib/learning/analyse.ts`. Never prefix with `NEXT_PUBLIC_` |

`.env.local` is git-ignored (`.env*` in `.gitignore`, except `.env.example`, which holds no values). On Vercel the two secret keys are set for Production only and marked Sensitive.

### Database and auth settings

The schema lives in `supabase/migrations/` and the auth settings and email templates in `supabase/config.toml` and `supabase/templates/`. With the Supabase CLI logged in (`npx supabase login`, run in a real terminal):

```bash
npx supabase db push --project-ref <ref> --dry-run   # see which migrations are pending
npx supabase db push --project-ref <ref>             # apply them
npx supabase config diff --project-ref <ref>         # then config push to apply auth settings
```

Every table with user data has row-level security with owner-only policies, and signed-out visitors have no access at all. Table design and access rules: [`docs/supabase-schema.md`](docs/supabase-schema.md).

## Scripts and tests

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`lib/**/*.test.mjs`, Node's built-in test runner): upload rules, AI answer parsing, focus list, usage display, exercise checking, and validation of all 81 exercise files |
| `npm run sync:exercises` | After editing `lib/exercises/data/*.json`: regenerate `lib/exercises/sets.ts` and the practice links |
| `bash e2e/learning.sh` | Browser checks of Customized Learning with a real AI call: login redirect, PDF/HEIC/Word/blank uploads, files deleted, focus, delete, and a **second user can't see the first user's documents** |
| `bash e2e/exercises.sh` | Browser checks of the practice pages: guest round, mistakes replay, answers saved when logged in, phone width, keyboard |
| `bash e2e/all-practice-pages.sh` | Opens all 81 practice pages and checks each shows its first question |

The browser checks use the global `playwright-cli` and test accounts from environment variables; see [`e2e/README.md`](e2e/README.md). Latest results: [`docs/testing.md`](docs/testing.md).

## How changes are made

Each change goes through a feature branch and a GitHub pull request. The `ai-code-reviewer` agent reviews the PR before it's merged, and its report is saved in [`docs/reviews/`](docs/reviews/) and posted on the PR:

- PR #1 Show the AI model and cost of each document: [report](docs/reviews/pr-1-model-and-cost.md)
- PR #2 Add Practise my focus and send signed-out visitors to login: [report](docs/reviews/pr-2-practise-my-focus.md)

Security scans (`/security-scan`, `/security-scan-changed`) run with three scanner agents (Supabase, Next.js, Vercel).

## Project layout

| Path | What's there |
|---|---|
| `app/learning/` | Customized Learning page, the upload/delete/focus server actions, and Practise my focus |
| `lib/learning/` | Upload rules, the OpenRouter call (`analyse.ts`), AI answer checks, Word reader, focus list, progress, usage display |
| `components/learning/` | Upload box, focus list, document list, Add-to-focus button |
| `app/topics/` | Grammar Topics library, topic pages, practice pages and the answer-saving server action |
| `lib/exercises/` | Exercise types, answer checking, the 81 exercise files (`data/`) and the generated index |
| `components/exercises/ExerciseSession.tsx` | The practice round UI |
| `app/articles/`, `components/ArticlesGame.tsx` | der · die · das flashcards |
| `app/progress/`, `app/account/`, `app/login`, `app/auth/*` | Progress, account (log out, delete account), login, sign-up, password reset, callbacks |
| `lib/supabase/` | Browser, server and proxy Supabase clients; `proxy.ts` sends signed-out visitors away from `/learning`, `/progress` and `/account` |
| `supabase/` | Migrations, auth config, email templates |
| `e2e/` | Browser check scripts and fixtures |
| `docs/` | Schema, OpenRouter reference, testing results, PR reviews, design specs and plans |

## Known limits

- Handwriting isn't supported; uploads should be printed or typed material.
- Emails are sent through Brevo's free plan (300/day) from a Gmail sender, so some may land in spam. A custom domain would fix that.
- Stats are computed from a user's whole answer history on each page load. That's fine for thousands of answers; move it into SQL if histories get much larger.
- The 100-uploads-a-day app-wide cap protects the AI budget but can be used up by about 10 accounts.
