# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A public German grammar trainer (A1–B2). The first topic is a flashcard game for noun articles (der/die/das) that explains the rule and exceptions behind each answer. More topics will follow (cases, verb conjugation, prepositions + case, possessive pronouns).

Guests can play without an account. Logged-in users get their own saved answer history, a progress page (overall accuracy, accuracy per der/die/das and per rule, trouble words) and a "Practise my mistakes" round. A trouble word leaves that list after 2 correct answers in a row.

Implementation plan: `docs/plan.md`.


### Seed data (`lib/flashcards/data/`) (automated, haven't edited)

The deck ships pre-seeded with `seed.json` (~1,000 cards, currently 976 after the A1–B2 level pass removed 20 unsuitable words), generated from the rule set in `rules.json` (also what powers the `/rules` page). Both were built via background research agents from real German grammar sources and a Wiktionary-derived noun+gender dataset, then the deck went through a CEFR-level audit against official Goethe-Institut A1/A2/B1 word lists plus manual review (confirmed 91%+ A1-B2; the rest is the most everyday word available within an inherently formal rule family, e.g. -tum/-ismus vocab) — don't reintroduce obscure/technical/off-tone words when adding or regenerating entries.

**Important**: the build script and raw source datasets (the 87k-entry noun+gender CSV, the frequency list, the CEFR word lists, the audit/replacement scripts) were never committed — they only ever existed in an ephemeral session scratchpad and are gone. `seed.json`/`rules.json` are the only durable output. Regenerating or meaningfully expanding the deck means re-sourcing data from scratch (e.g. a fresh Wiktionary-derived German noun+gender dataset), not looking for a pipeline in this repo.

### Visual design

`app/globals.css` defines the design tokens (`--paper`, `--accent`, `--accent-deep`, `--ink-soft`, `--line`) for an "editorial/neo-brutalist" look (grid background, hard drop-shadows, Geist Sans), with light and dark variants of each token. A round toggle button in `NavBar` (`components/ThemeToggle.tsx`) switches between them; the choice is persisted in `localStorage` and read via `lib/theme/context.tsx`. Tailwind's `dark:` variant is retargeted in `globals.css` (`@custom-variant dark`) to key off the `data-theme` attribute on `<html>` rather than OS preference, so components should keep using ordinary `dark:` utility classes.

## Tech Stack (fixed)

* Next.js (App Router)
* TypeScript
* Tailwind CSS 4
* Supabase (auth: email+password and Google; Postgres with RLS) for logged-in users' data
* LocalStorage only for guest progress and per-browser preferences (theme, chosen level)

## Run

The app runs locally at `localhost:3000`. Do not swap any part of this stack.

## General Requirements

* At least two pages, including one detail page with its own address/route.
* The word list is built-in and the same for everyone (~1,000 cards covering the rules on `/rules`); users can't add, edit or delete cards.
* Every word has a level (A1–B2); the player picks a level before a round.
* A short description on how to use the app is shown 
* Logged-in users' answers persist in Supabase; guest progress persists in LocalStorage.
* No blank screens: show a readable empty-state message when there is no data yet, and a friendly "not found" message for a route/address that doesn't exist.

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

## Do Not

* Install additional packages without asking first.
