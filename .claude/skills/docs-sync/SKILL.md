---
name: docs-sync
description: Bring DE-app's documentation up to date with the current branch and remove the code the change left unused. Use on a feature branch as soon as a new feature or major change is finished, before running the ai-code-reviewer. A major change is anything that adds, renames or removes a file, function, component, route, table, setting, env var, script or rule, or changes what the user sees. Skip it for typo, wording-only and one-line fixes. Also use when the owner asks to update the docs or clean up.
---

# Docs sync and cleanup

Project rule: "after major changes or new feature get implemented, update documentation and do
the cleanup of old code". This skill does both for the current branch, on that branch.

Run git commands one per call (no `&&` chains). If you can't ask the owner something (for
example, you are running as a subagent), don't do it: list it under "Waiting for you".

## Step 1: What changed

1. If the current branch is `main`, stop: changes go through a feature branch. If you are in a
   worktree whose branch isn't the feature branch, say so in the report.
2. Run `git fetch origin main`, then `git merge-base FETCH_HEAD HEAD`. If either fails, stop and
   say so.
3. Read `git diff <that commit>` and `git ls-files --others --exclude-standard` (new files not
   committed yet). Also read `git log --oneline <that commit>..HEAD` for what the branch meant to do.
4. In two or three lines, write down what the change does for the user and what it changes
   underneath (new or renamed files, functions, settings, tables, scripts, rules).

## Step 2: Find the docs it makes wrong

Check each doc against the change. Read the parts that touch it; don't assume they are fine.

| Doc | Update when the change touches |
|---|---|
| `README.md` | what the app does, setup, env vars, scripts, how changes are made, project layout, known limits |
| `CLAUDE.md` | the overview, requirements, AI rules, game behaviour, working rules, or any file, function or setting it names |
| `.env.example` | env vars added, renamed or removed |
| `docs/supabase-schema.md` | migrations, tables, columns, policies, grants, functions, storage, auth settings |
| `e2e/README.md`, `docs/testing.md` | test commands, test setup, what the tests cover (test counts: see step 5) |
| `docs/openrouter-multimodal.md` | the OpenRouter call, the model, file handling, the prompt |
| `docs/sources.md` | a new library or reference the change relied on |
| `docs/todo.md` | an item this branch finishes (remove it) or a follow-up it leaves (add it) |
| `.claude/agents/*`, `.claude/commands/*`, `.claude/skills/*` | anything they name that the change renamed, moved or removed |
| code comments | a comment next to changed code that now says something untrue |

Also grep all the docs above for every name the change removed or renamed (files, functions,
components, env vars, scripts, routes); each hit is either updated or confirmed still correct.

**Leave records alone:** `docs/superpowers/specs/*`, `docs/superpowers/plans/*`,
`docs/reviews/*`, `REFLECTION.md` (local, not in git), `scripts/*/README.md` of pipelines that
already ran, and `AGENTS.md` (written by `next dev`). They describe what was true at the time.
Only mention it if one is misleading.

## Step 3: Find the code the change left unused

If the branch removed or replaced nothing (for example a docs- or config-only change), say so and
skip this step.

1. For each function, component, type, constant, file, CSS class (`@utility` in
   `app/globals.css`), env var, npm script or package the change stopped using or replaced, grep
   the whole repo for remaining uses (code, tests, docs, `package.json`, `.env.example`).
2. Also look for leftovers in and next to the changed code: a branch that can't happen any more,
   a parameter nobody passes, an old version kept "just in case", a commented-out block.
3. Unused means no use anywhere outside its own definition and tests. Something still used by a
   test only is unused: remove the test with it.

## Step 4: Fix

- Update the docs in place. Match the doc's style: plain, short sentences, no new sections unless
  the change needs one. Say what is true; don't narrate the change ("now", "we changed").
- Remove unused code and the tests that only covered it.
- **Ask first** before deleting a whole file the owner may still want (docs, scripts, data),
  removing a package from `package.json`, or changing a rule in `CLAUDE.md`'s Working Rules or Do
  Not. Never install anything.
- Never touch `lib/flashcards/data/*`, `lib/exercises/data/*` or migrations already applied:
  ids and history there must not change.

## Step 5: Check and report

1. If `node_modules` is missing, stop and ask (don't install). Run `npx next typegen` first:
   without it `tsc` reports `PageProps`/`LayoutProps` errors that aren't real.
2. Run `npx tsc --noEmit`, `npm run lint` and `npm test`. If something removed broke them, put it
   back or fix the caller, and say which. If a doc you updated states test counts, update them
   from this run.
3. If you changed anything, commit on the branch: `Docs and cleanup for <the change>`. Otherwise
   don't commit.
4. Report to the owner, short:
   - **Updated:** each doc, one line on what it says now.
   - **Removed:** each piece of unused code, and why it's unused.
   - **Waiting for you:** anything from "Ask first".
   - **Checked, no change needed:** the docs from step 2 that were already right.
   - **Checks:** tsc, lint, `npm test` results, and the commit (or "no commit, nothing changed").
