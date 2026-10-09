# Grammar exercises — design

Date: 2026-10-09. Agreed with the user before they left (answers to 7 questions). Builds on
the Grammar Topics library (`lib/grammar/topics.json`, 82 topics A1–C2) and Customized
Learning (focus list + per-topic progress from `public.attempts`).

## Goal

Every catalogue topic gets a practice exercise reachable from its topic page, so the
"Practise" button on topic pages and in "Your focus now" leads somewhere for all topics, and
logged-in learners' answers feed their progress.

## Decisions

| Area | Decision |
|---|---|
| Address | `/topics/<slug>/practice` (unknown slug or no exercises → not found) |
| Exercise types | Chosen per topic by what suits the grammar (user: "pick the best option for each"). Three item types, mixable within a topic: **choice** (pick the answer, 2–4 options, flashcard-style), **type** (type the missing word/form), **order** (put the words in the right order). noun-gender keeps its existing der·die·das flashcards (`/articles`). |
| Content | Written ahead of time, stored in the app as one JSON file per topic, same for everyone, no AI at runtime. Every topic's German is checked by a second, stronger AI reviewer before it's committed. |
| Size | 30 items per topic, played in rounds of 10 (random order). |
| Language | Instructions and explanations in English; exercise sentences in German, vocabulary at the topic's CEFR level. |
| Feedback | After each answer: correct/wrong, the right answer, and a one- or two-sentence English explanation of the rule. |
| Round end | Score for the round; "Practise my mistakes (N)" replays this round's misses; "Next 10"; back to the topic. |
| Saving | Logged in: every answer saved to `public.attempts` (topic = slug, item_id, answer clipped to 64 chars), correctness decided on the server. Guests: play without saving. Feeds "Your focus now", the topic page, the Grammar Topics library and (topic accuracy) progress. |
| Checking typed answers | Trim and collapse spaces; case-sensitive (capitals are grammar in German); several accepted answers allowed per item. Word order: several accepted orders allowed. |
| Database | No change needed: `attempts` accepts any topic ≤ 32 chars (longest slug is 29), answers ≤ 64, rate limit 120/min. |
| Build order | Shared exercise screen first; then content level by level (A1 → A2 → B1 → B2 → C1 → C2), one commit per level. |
| Boundaries | Branch `feature/grammar-exercises` only; DB changes allowed if needed (with tests); no merge, push or live changes without the user. |

## Out of scope

AI-generated exercises, audio, spaced repetition, per-item trouble lists for new topics, a
redesigned Progress page (it keeps der·die·das stats; topic accuracy shows on topic pages and
in "Your focus now").
