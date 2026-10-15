# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DE-app turns what you're learning in German class into your own practice plan.**

Learners of German get worksheets, textbook pages and corrected homework every week, but a generic grammar app doesn't know what any of that contains. In DE-app you upload it (a PDF, a Word file or up to 5 photos) on **Customized Learning**. An AI model reads the document, works out which grammar it practises and which mistakes your teacher marked, and picks 1–6 well-supported topics from the app's fixed catalogue of 82 A1–C2 grammar topics, each with a reason quoting your document. Those topics become **Your focus now**: a list ranked by mistakes and how often a topic comes up, with your progress on each, and a **Practise my focus** round that mixes exercises from exactly those topics.

**Why the app is pointless without the AI.** The topic library and the exercises are generic; any textbook has them. What a learner can't easily do alone is look at this week's worksheet and know which grammar it's drilling and which of their mistakes matter. Reading the learner's own material (printed or typed pages, including homework with the teacher's corrections) and mapping it onto the right topics is the AI's job, and it's the reason to open the app. Without it DE-app is a static exercise book that doesn't know what you're learning.

What else is in the app, in support of that:

- **Grammar Topics** (`/topics`): the 82-topic catalogue (A1 19, A2 15, B1 17, B2 10, C1 14, C2 7), open to everyone. Each topic page explains the topic and links to its practice.
- **Practice pages** (`/topics/<slug>/practice`): 30 checked exercises per topic (pick the answer, type the word, put the words in order), rounds of 10, an explanation after each answer and a "Practise my mistakes" round. Labelled "still in test mode".
- **der · die · das** (`/articles`): the original flashcard game for noun gender (1,286 A1–C2 nouns, every answer explained by its rule).
- **Progress**: logged-in answers are saved per topic and shown on topic pages, the Grammar Topics cards, Your focus now and `/progress`.

Guests can browse Grammar Topics and practise without saving. Customized Learning, progress and account pages need an account; logged-in users land on Customized Learning.

Design docs: `docs/superpowers/specs/` (Customized Learning, grammar exercises). Database: `docs/supabase-schema.md`. AI integration reference: `docs/openrouter-multimodal.md`.

### Seed data (`lib/flashcards/data/`) (automated, haven't edited)

The deck ships pre-seeded with `seed.json` (1,286 cards: A1 139, A2 133, B1 443, B2 276, C1 180, C2 115; the A1–B2 level pass had removed 20 unsuitable words, leaving 976), generated from the rule set in `rules.json` (also what powers the `/rules` page). Both were built via background research agents from real German grammar sources and a Wiktionary-derived noun+gender dataset, then the deck went through a CEFR-level audit against official Goethe-Institut A1/A2/B1 word lists plus manual review (confirmed 91%+ A1-B2; the rest is the most everyday word available within an inherently formal rule family, e.g. -tum/-ismus vocab) — don't reintroduce obscure/technical/off-tone words when adding or regenerating entries. C1/C2 words were added in 2026-10 through the committed pipeline in `scripts/c-levels/` (see its README), with levels judged and checked against a frequency list and articles checked against Wiktionary.

**Important**: the build script and raw source datasets (the 87k-entry noun+gender CSV, the frequency list, the CEFR word lists, the audit/replacement scripts) were never committed — they only ever existed in an ephemeral session scratchpad and are gone. `seed.json`/`rules.json` are the only durable output. Regenerating or meaningfully expanding the deck means re-sourcing data from scratch (e.g. a fresh Wiktionary-derived German noun+gender dataset), not looking for a pipeline in this repo. What did survive are the later one-off steps in `scripts/`: `add-ids-and-rules.mjs` (froze card ids and linked each card to its rule) and `scripts/levels/` (`assign-levels.mjs` and `apply-levels.mjs` gave cards their A1–B2 level from the Goethe word lists, with `levels-review.csv` as the hand-reviewed overrides). They've already been run; keep them as the record of how levels were assigned, and never renumber card ids. This paragraph describes the original A1–B2 deck; the C1/C2 words have their own committed pipeline in `scripts/c-levels/` (see its README).

### Exercise data (`lib/exercises/data/`)

One JSON file per topic (81 files; noun-gender uses `/articles`), 30 items each, validated by `lib/exercises/data.test.mjs`. After adding or editing a file, run `npm run sync:exercises` (regenerates `lib/exercises/sets.ts` and the practice links in `lib/grammar/topics.json`). Never rename a topic slug or reuse an item id: saved answers refer to them. To find and fix weak items, run `/improve-exercises <level or slug>`: editor and verifier agents fix the sets, checks run, and it ends in a PR to approve (one level per PR, A1 → C2).

### Visual design

`app/globals.css` defines the design tokens (`--paper`, `--accent`, `--accent-deep`, `--ink-soft`, `--line`) for an "editorial/neo-brutalist" look (grid background, hard drop-shadows, Geist Sans), with light and dark variants of each token. A round toggle button in `NavBar` (`components/ThemeToggle.tsx`) switches between them; the choice is persisted in `localStorage` and applied before first paint by an inline script in `app/layout.tsx`. Tailwind's `dark:` variant is retargeted in `globals.css` (`@custom-variant dark`) to key off the `data-theme` attribute on `<html>` rather than OS preference, so components should keep using ordinary `dark:` utility classes.

## Tech Stack (fixed)

* Next.js (App Router)
* TypeScript, with database types generated from the schema (`lib/supabase/database.types.ts`, `npm run db:types` once a migration is live) and passed to every Supabase client
* Tailwind CSS 4
* Supabase (auth: email+password and Google; Postgres with RLS; Storage for uploads in transit) for logged-in users' data
* OpenRouter for the AI model (server-side only)
* LocalStorage only for guest progress and per-browser preferences (theme, chosen level, auto-advance)

## Run

The app runs locally at `localhost:3000` and live at https://de-app-six.vercel.app. Do not swap any part of this stack. Node 24 (`.nvmrc`); install with `npm ci` from the lockfile.

Tests: `npm test` (unit), `npm run test:db` (pgTAP) and `npm run test:e2e` (Playwright Test, fake OpenRouter) run against a throwaway local Supabase (`npm run db:start`, needs OrbStack or Docker), never the live project; `npm run test:smoke` is the one real-model test. See `e2e/README.md`. React Compiler is on (`reactCompiler: true`), so don't add `useMemo`/`useCallback`; keep state that must survive renders (like a shuffled round) in state, not in a memo.

## General Requirements


* The word list and the exercises are built-in and the same for everyone; users can't add, edit or delete them.
* Every flashcard word has a level (A1–C2); the player picks a level before a round. Grammar topics span A1–C2.
* A short description on how to use the app is shown
* Logged-in users' answers, documents and focus changes persist in Supabase; guest progress persists in LocalStorage.
* Users can download everything saved in their account as JSON ("Download my data" on `/account`, `app/account/export/route.ts`) and delete their account; deletion stops (and says so) if their leftover uploaded files can't be removed, so no files are left without an owner. The privacy page (`app/privacy/page.tsx`) lists what is stored, why, which services receive it, how long it's kept and the user's rights: update it whenever any of that changes.
* No blank screens: show a readable empty-state message when there is no data yet, and a friendly "not found" message for a route/address that doesn't exist.
* A failed read is not an empty state: when data can't be loaded, say so and offer "Try again" (`components/LoadError.tsx`, `app/error.tsx`); `loadFocus()` and `loadDocumentsAndFocus()` return `{ ok: false }` instead of empty lists.
* Saving an answer never blocks practice. Answer-saving actions return a typed `SaveResult`; failures show "N answers not saved · Retry" under the exercise (`components/UnsavedAnswers.tsx`). Each answer carries a browser-made id (`attempts.client_id`, unique per user), so a retry never counts it twice.

## AI rules

AI model calls:
- All LLM and embedding calls must happen server-side only. Never call OpenRouter
  from browser code.
- OPENROUTER_API_KEY lives in .env.local and must never have a NEXT_PUBLIC_ prefix
  or be passed to client components.
- Model: google/gemini-2.5-flash-lite

How the app applies these rules:
- The only OpenRouter call is in `lib/learning/analyse.ts`, which starts with `import "server-only"` and is called only from the server action in `app/learning/actions.ts`. The model slug is the `ANALYSIS_MODEL` constant there; change it in that one place. `OPENROUTER_BASE_URL` exists only so the browser tests can point the app at `e2e/mock-openrouter.mjs`; never set it in production.
- The instructions live in `lib/learning/prompt.ts` (`SYSTEM_PROMPT`, sent as the system message) with a `PROMPT_VERSION`: bump it whenever the wording changes. The uploaded document goes in its own user message and is treated as untrusted content, never as instructions.
- PDFs are sent with the `file-parser` plugin set to `engine: "native"`. Never omit the engine: the default falls back to paid OCR.
- Every request sets `provider: { zdr: true }`, so OpenRouter routes documents only to zero-data-retention providers; the privacy page promises this, and the fake OpenRouter refuses a request without it. OpenRouter errors are logged as status and error code only, never the message or body (they can quote the document).
- The screen says "AI" wherever AI output appears: the upload box ("An AI model … reads your document"), each document ("AI-suggested by …", "Text read by AI (may contain errors)") and the how-it-works steps.
- The model must answer in the strict JSON schema in `lib/learning/suggestions.ts`: one Zod schema gives the type (`z.infer`), the JSON schema sent to the model (`z.toJSONSchema`) and the check (`safeParse`). `parseAnalysis` then keeps only catalogue topics and returns one of four outcomes: topics found, no grammar (readable text, nothing to practise), `"unreadable"` (no text at all) or `"invalid"` (doesn't fit the schema, or names no catalogue topic). An invalid answer is an error, never "no grammar". The model is asked for 1–6 well-supported topics, not a minimum, and must say so when a document has no readable text instead of guessing (a blank photo made it invent text in testing).
- Word files are read with `mammoth.extractRawText()` and PDFs' pages counted with pdf-lib (`lib/learning/documents.ts`), each only after our own limits: the 10 MB file cap, and for Word a zip-bomb guard that unpacks every entry with a hard cap first (mammoth's zip library checks sizes only after unpacking). Word formatting (colours, crossed-out corrections) is lost, so the upload box asks for a PDF or photo when corrections matter.
- Handwritten notes are expected. The prompt asks the model to read sideways photos upright, leave out crossed-out words and write `[?]` for unreadable words (asked, not guaranteed: in testing it read neat handwriting well but still guessed unclear words and kept crossed-out ones). Colour, underlining and boxes mean emphasis, not mistakes; only clear correction marks count as mistakes (not yet tested on real teacher corrections).
- A document with no readable text is not saved: for photos the user sees "We couldn't read any text in this photo. Try a sharper photo in good light, or write a little larger.", for PDF and Word a similar message, and the upload still counts (the AI call was paid, and giving it back would let blank photos bypass the daily spend limit). The same goes for an invalid AI answer.
- Choosing files doesn't upload them: the upload box lists the chosen files (photo previews where the browser can show them) and uploads only after "Read …", so a wrong pick uses no quota.
- Uploaded files are deleted after every analysis, success or failure. What is stored per document: the title, the text read, the "no grammar" flag, the suggestions, and the model, token counts and cost. Each upload also adds a row (user and time) to the upload counter.

The app does not use embeddings or RAG.

## Flashcard Game Interaction Requirements

* Layout is responsive: sidebar + game panel on desktop, stacked on mobile.
* Rounds are fixed at 30 cards and always run to completion regardless of mistakes.
* At round end: "Learn from your mistakes (N)" (recap of just this round's misses, itself capped to those cards) or "Next 30 words" (fresh deck) — never auto-loops into recap.
* "This deck: X/Y" score is scoped to the current deck only and resets every new deck; recap answers don't count toward it.
* Restart gives a fresh deck and resets session-wide stats; "Next 30 words" only resets the per-deck score.
* Session-wide stats (bottom of the game page, hidden in "Practise my mistakes" mode): Decks played, Mistakes fixed (a base-round miss later answered correctly in recap), Overall accuracy % (base-deck answers only).
* Each card is a flip: the noun + der/die/das buttons on the front; picking one flips it in place (correct green, wrong red) to reveal the rule and any exception — no separate panel, no big "next" button.
* Correct answers move on by themselves after 1.5 s by default. The learner can change this under each exercise ("After a correct answer, go on": after 1.5 seconds / after 3 seconds / when I click or press Enter), remembered per browser (`de-app:advance` in localStorage, `components/AdvanceSetting.tsx`). After a mistake, after a correct answer on a card with an exception note, or always when auto-advance is off, a click anywhere (not on links, buttons, fields or while selecting text) or Enter continues, and a hint "Tap or click anywhere, or press Enter to continue" shows only then. ← / → move between the der · die · das buttons and Enter picks, so the game is fully keyboard-playable. The first answer button is focused on each new card. The result is announced to screen readers via a `role="status"` live region. Topic practice and Practise my focus answer the same way.
* On phones the card comes first; the intro/how-to sidebar moves below it.
* A card is auto-flagged "needs practice" after 2 wrong answers in a row (shown as a badge) — not explained in the on-screen "how to use" copy.
* Every answer shows the grammar rule; exceptions are explained too, not just the base rule.
* The specific suffix/prefix a rule hinges on (e.g. **-ung**, **Ge-**) is bolded wherever it appears, on both the flashcard and the `/rules` page.

## Working Rules

- If instructions are unclear, ask me for clarification, don't make assumptions
- Keep the design clean and conscise througout pages
- Every new Supabase table needs RLS policies and the anon-access revoke (see `docs/supabase-schema.md`).
- All secrets should live in *env files
- Changes go through a feature branch and a pull request; run the `ai-code-reviewer` agent on the PR before merging and save its report in `docs/reviews/` (skip it for prose-only docs, as defined in `/pre-merge`). `/pre-merge` runs the reviewer and the security scanners the changed files need.
- Before merging, suggest needed usability tests with Playwright
- Propose security scans: `/security-scan` weekly to confirm the whole codebase is clean, and `/security-scan-changed` through `/pre-merge` on every pull request whose changed files need it, to catch new problems before they merge into main.
- Before writing a parser, validator, protocol client or other non-trivial helper, check for a well-established library first: ask the DeepWiki MCP (`ask_wiki_question`) how candidate libraries handle the job and its edge cases (limits, malformed input, security), and confirm the claim in the library's source. Prefer the library when it is at least as safe and removes real code; keep our own code when it is safer (e.g. a size limit the library lacks), and say why.
- npm only resolves package versions published at least 7 days ago (set in `.npmrc`, and in the user `~/.npmrc` so global installs are covered too)
- when giving me technical option or asking me to install anything, explain in simple words why it's needed and what it would allow you to do
- After a new feature or major change (anything that adds, renames or removes a file, function, component, route, table, setting, env var, script or rule, or changes what the user sees), run `/docs-sync` before the code review: it updates the documentation and removes the old code the change left unused.

## Do Not

* Install additional packages without asking first.
