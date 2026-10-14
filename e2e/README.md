# Browser and database tests

The browser tests use [Playwright Test](https://playwright.dev/docs/intro) (`@playwright/test`), the database tests use
[pgTAP](https://pgtap.org) through `supabase test db`. Both run against a **throwaway local Supabase** started with the
Supabase CLI, never the live project, so tests can create users and data freely and leave nothing behind.

## Setup (once)

1. Install [OrbStack](https://orbstack.dev) (or Docker Desktop) and open it. The Supabase CLI uses it to run the local database.
   On macOS, allow it to read the project folder when asked (System Settings → Privacy & Security → Files and Folders →
   OrbStack → Documents Folder, if the project is in Documents); without that, `npm run test:db` hangs with no output.
   If a terminal says `docker: command not found`, open a new terminal window after installing.
2. `npx playwright install chromium` downloads the browser Playwright drives.

## Run

```bash
npm run db:start      # starts the local Supabase and applies every migration (first time: a few minutes of downloads)
npm run test:db       # pgTAP: privacy between users, the upload allowance, answer ids (about 10 s)
npm run test:e2e      # Playwright: builds the app into .next-e2e, starts it with a fake OpenRouter, runs every spec
npm run db:stop       # when you're done (or leave it running between runs)
```

Before each run, `e2e/global-setup.ts` clears the local upload counter (all of it, including uploads from your own manual testing on the local database), so earlier runs can't use up the app-wide limit of 100 uploads a day. `npm run test:e2e` fails straight away with a clear message if the local Supabase isn't running, and refuses any
Supabase URL that isn't on `127.0.0.1`/`localhost`. A failed test keeps a trace: open the report with
`npx playwright show-report` and click the trace to replay it step by step.

`npm run test:smoke` runs the one **real-model** test (`smoke.real.spec.ts`): it uploads the Lektion 7 PDF and checks the
real `google/gemini-2.5-flash-lite` suggests dative topics. It uses `OPENROUTER_API_KEY` from `.env.local` and costs about
$0.0005, so run it before merging a change to the prompt, the AI request or the answer schema, not on every change.

## What's covered

| Spec | What it checks |
|---|---|
| `learning.spec.ts` | Login redirects; the review step (nothing uploaded or counted until "Read"); PDF, HEIC and Word uploads saved with their topics and focus; an unreadable photo, an invalid AI answer and a no-grammar document each handled as their own outcome; `.doc` and 6 photos refused without using an upload; uploaded files deleted; focus add/remove; deleting a document; a second user sees none of it |
| `auth.spec.ts` | Login and sign-up forms: plain-words errors (wrong password, passwords that don't match, an existing account), the email kept after an error, the password cleared |
| `faults.spec.ts` | A failed database read shows "Couldn't load … Try again", never the empty state, and recovers (runs last, alone) |
| `saving.spec.ts` | A failed answer save shows "N answers not saved · Retry" without blocking practice; Retry saves it exactly once, even when the first try reached the server; the logged-out case |
| `exercises.spec.ts` | Guest rounds, mistakes rounds, Next 10, 404s, keyboard (Enter, arrows), auto-advance and its setting, phone width, answers saved and accuracy shown when logged in |
| `articles.spec.ts` | der · die · das: level picker, keyboard, waiting after mistakes, Restart, level change and refresh mid-round, old saved level, `/rules`, phone width |
| `mobile.spec.ts` | Phone width with the on-screen keyboard open (a short viewport): the upload review buttons and the auto-advance setting stay reachable |
| `practice-pages.spec.ts` | All 81 practice pages show question 1 with no console errors |
| `smoke.real.spec.ts` | The real model, end to end (only with `npm run test:smoke`) |

## The fake OpenRouter

`mock-openrouter.mjs` answers the app's AI request so tests are free and repeatable, and it rejects requests that break
the integration rules: instructions not in a system message, the document not in its own user message, a non-strict
schema, or a PDF without the native file parser. A marker inside an uploaded file picks the answer: `MOCK:BLANK` (no
readable text), `MOCK:INVALID` (topics outside the catalogue), `MOCK:NOGRAMMAR`; anything else gets the Lektion 7 dative
answer. `fixtures/` holds only the German sample "Lektion 7: Präpositionen mit Dativ …", a blank PNG and a one-line `old.doc`.
