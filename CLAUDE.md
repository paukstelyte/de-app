# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DE-app turns what you're learning in German class into your own practice plan.**

Learners of German get worksheets, textbook pages and corrected homework every week, but a generic grammar app doesn't know what any of that contains. In DE-app you upload it (a PDF, a Word file or up to 5 photos) on **Customized Learning**. An AI model reads the document, works out which grammar it practises and which mistakes your teacher marked, and picks 3–6 topics from the app's fixed catalogue of 82 A1–C2 grammar topics, each with a reason quoting your document. Those topics become **Your focus now**: a list ranked by mistakes and how often a topic comes up, with your progress on each, and a **Practise my focus** round that mixes exercises from exactly those topics.

**Why the app is pointless without the AI.** The topic library and the exercises are generic; any textbook has them. What a learner can't easily do alone is look at this week's worksheet and know which grammar it's drilling and which of their mistakes matter. Reading the learner's own material (printed or typed pages, including homework with the teacher's corrections) and mapping it onto the right topics is the AI's job, and it's the reason to open the app. Without it DE-app is a static exercise book that doesn't know what you're learning.

What else is in the app, in support of that:

- **Grammar Topics** (`/topics`): the 82-topic catalogue (A1 19, A2 15, B1 17, B2 10, C1 14, C2 7), open to everyone. Each topic page explains the topic and links to its practice.
- **Practice pages** (`/topics/<slug>/practice`): 30 checked exercises per topic (pick the answer, type the word, put the words in order), rounds of 10, an explanation after each answer and a "Practise my mistakes" round. Labelled "still in test mode".
- **der · die · das** (`/articles`): the original flashcard game for noun gender (~1,000 A1–B2 nouns, every answer explained by its rule).
- **Progress**: logged-in answers are saved per topic and shown on topic pages, the Grammar Topics cards, Your focus now and `/progress`.

Guests can browse Grammar Topics and practise without saving. Customized Learning, progress and account pages need an account; logged-in users land on Customized Learning.

Design docs: `docs/superpowers/specs/` (Customized Learning, grammar exercises). Database: `docs/supabase-schema.md`. AI integration reference: `docs/openrouter-multimodal.md`.

### Seed data (`lib/flashcards/data/`) (automated, haven't edited)

The deck ships pre-seeded with `seed.json` (~1,000 cards, currently 976 after the A1–B2 level pass removed 20 unsuitable words), generated from the rule set in `rules.json` (also what powers the `/rules` page). Both were built via background research agents from real German grammar sources and a Wiktionary-derived noun+gender dataset, then the deck went through a CEFR-level audit against official Goethe-Institut A1/A2/B1 word lists plus manual review (confirmed 91%+ A1-B2; the rest is the most everyday word available within an inherently formal rule family, e.g. -tum/-ismus vocab) — don't reintroduce obscure/technical/off-tone words when adding or regenerating entries.

**Important**: the build script and raw source datasets (the 87k-entry noun+gender CSV, the frequency list, the CEFR word lists, the audit/replacement scripts) were never committed — they only ever existed in an ephemeral session scratchpad and are gone. `seed.json`/`rules.json` are the only durable output. Regenerating or meaningfully expanding the deck means re-sourcing data from scratch (e.g. a fresh Wiktionary-derived German noun+gender dataset), not looking for a pipeline in this repo. What did survive are the later one-off steps in `scripts/`: `add-ids-and-rules.mjs` (froze card ids and linked each card to its rule) and `scripts/levels/` (`assign-levels.mjs` and `apply-levels.mjs` gave cards their A1–B2 level from the Goethe word lists, with `levels-review.csv` as the hand-reviewed overrides). They've already been run; keep them as the record of how levels were assigned, and never renumber card ids.

### Exercise data (`lib/exercises/data/`)

One JSON file per topic (81 files; noun-gender uses `/articles`), 30 items each, validated by `lib/exercises/data.test.mjs`. After adding or editing a file, run `npm run sync:exercises` (regenerates `lib/exercises/sets.ts` and the practice links in `lib/grammar/topics.json`). Never rename a topic slug or reuse an item id: saved answers refer to them.

### Visual design

`app/globals.css` defines the design tokens (`--paper`, `--accent`, `--accent-deep`, `--ink-soft`, `--line`) for an "editorial/neo-brutalist" look (grid background, hard drop-shadows, Geist Sans), with light and dark variants of each token. A round toggle button in `NavBar` (`components/ThemeToggle.tsx`) switches between them; the choice is persisted in `localStorage` and applied before first paint by an inline script in `app/layout.tsx`. Tailwind's `dark:` variant is retargeted in `globals.css` (`@custom-variant dark`) to key off the `data-theme` attribute on `<html>` rather than OS preference, so components should keep using ordinary `dark:` utility classes.

## Tech Stack (fixed)

* Next.js (App Router)
* TypeScript
* Tailwind CSS 4
* Supabase (auth: email+password and Google; Postgres with RLS; Storage for uploads in transit) for logged-in users' data
* OpenRouter for the AI model (server-side only)
* LocalStorage only for guest progress and per-browser preferences (theme, chosen level)

## Run

The app runs locally at `localhost:3000` and live at https://de-app-six.vercel.app. Do not swap any part of this stack.

## General Requirements

* At least two pages, including one detail page with its own address/route.
* The word list and the exercises are built-in and the same for everyone; users can't add, edit or delete them.
* Every flashcard word has a level (A1–B2); the player picks a level before a round. Grammar topics span A1–C2.
* A short description on how to use the app is shown
* Logged-in users' answers, documents and focus changes persist in Supabase; guest progress persists in LocalStorage.
* No blank screens: show a readable empty-state message when there is no data yet, and a friendly "not found" message for a route/address that doesn't exist.

## AI rules

AI model calls:
- All LLM and embedding calls must happen server-side only. Never call OpenRouter
  from browser code.
- OPENROUTER_API_KEY lives in .env.local and must never have a NEXT_PUBLIC_ prefix
  or be passed to client components.
- Model: google/gemini-2.5-flash-lite

How the app applies these rules:
- The only OpenRouter call is in `lib/learning/analyse.ts`, which starts with `import "server-only"` and is called only from the server action in `app/learning/actions.ts`. The model slug is the `ANALYSIS_MODEL` constant there; change it in that one place.
- PDFs are sent with the `file-parser` plugin set to `engine: "native"`. Never omit the engine: the default falls back to paid OCR.
- The model must answer in the strict JSON schema in `lib/learning/suggestions.ts`; `parseAnalysis` keeps only catalogue topics. If a document has no readable text or no German grammar, the model must say so instead of guessing (a blank photo made it invent text in testing).
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
* Click anywhere on a flipped card to advance. The small "Tap or press Enter to continue" hint is a real button that receives focus after answering, and the first answer button is focused on each new card, so the game is fully keyboard-playable. The result is announced to screen readers via a `role="status"` live region.
* On phones the card comes first; the intro/how-to sidebar moves below it.
* A card is auto-flagged "needs practice" after 2 wrong answers in a row (shown as a badge) — not explained in the on-screen "how to use" copy.
* Every answer shows the grammar rule; exceptions are explained too, not just the base rule.
* The specific suffix/prefix a rule hinges on (e.g. **-ung**, **Ge-**) is bolded wherever it appears, on both the flashcard and the `/rules` page.

## Working Rules

- If instructions are unclear, ask me for clarification, don't make assumptions
- Keep the design clean and conscise througout pages
- Every new Supabase table needs RLS policies and the anon-access revoke (see `docs/supabase-schema.md`).
- All secrets should live in *env files
- Changes go through a feature branch and a pull request; run the `ai-code-reviewer` agent on the PR before merging and save its report in `docs/reviews/`.
- Before merging, suggest needed usability and security tests
- Propose security scans at these moments:

  | Command | When to use it |
  |---|---|
  | `/security-scan` | Periodically (monthly, or before a big release or production deploy) to confirm the whole codebase is clean. |
  | `/security-scan-changed` | On every feature branch and pull request, to catch new problems before they merge into main. |

## Do Not

* Install additional packages without asking first.
