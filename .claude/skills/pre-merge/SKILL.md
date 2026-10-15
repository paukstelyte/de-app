---
name: pre-merge
description: Before merging a DE-app pull request, run the checks its changed files need (the ai-code-reviewer and only the relevant security scanners, in parallel), fix what they find, save the report and ask the owner to merge. Use when a branch is ready for review, or when the owner says "pre-merge" or asks to check a PR before merging.
---

# Pre-merge checks

Runs the code review and the security scan a branch needs, and no more. Never merges: it ends by
asking the owner. Run git commands one per call (no `&&` chains).

## Step 1: Changed files

1. If the current branch is `main`, stop: changes go through a feature branch.
2. Run `git fetch origin main`, then `git merge-base origin/main HEAD`. If either fails, stop and
   say so.
3. Changed files: `git diff --name-only <that commit>` plus
   `git ls-files --others --exclude-standard`. If there are none, stop.
4. If the branch is a new feature or major change and `/docs-sync` hasn't run on it yet, run it
   first (CLAUDE.md rule).

## Step 2: Pick the checks

Put every changed file in the first row that matches it:

| Files | Reviewer | Supabase | Next.js | Vercel |
|---|---|---|---|---|
| Prose: `*.md` and images outside `.claude/`, except `CLAUDE.md` | – | – | – | – |
| Instructions: `.claude/**`, `CLAUDE.md` | ✓ | – | – | – |
| Data: `lib/exercises/data/*`, `lib/flashcards/data/*`, `lib/grammar/topics.json`, `lib/exercises/sets.ts` | ✓ | – | – | – |
| Tests and local tools: `e2e/**`, `supabase/tests/**`, `**/*.test.mjs`, `scripts/**`, `playwright.config.ts` | ✓ | – | – | – |
| Database: `supabase/**` (other), `lib/supabase/**` | ✓ | ✓ | – | – |
| Deployment: `next.config.*`, `proxy.ts`, `vercel.json`, `.env.example`, `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `.gitignore` | ✓ | – | ✓ | ✓ |
| App code: `app/**`, `components/**`, `lib/**` (other), `public/**` | ✓ | if the file mentions `supabase`, `.from(` or `.rpc(` | ✓ | – |
| Anything else | ✓ | ✓ | ✓ | ✓ |

The checks to run are every ✓ from any changed file. Tell the owner in one line before starting,
e.g. "Running: reviewer + Next.js scanner (app code changed; no database or deployment files)."
If the owner says "run everything", run the reviewer and all three scanners.

Prose only (no ✓ at all): say "Skipped: prose only", put that line in the PR description, and go
to step 5.

## Step 3: Run them in parallel

In a single message, launch:
- the `ai-code-reviewer` agent, with the PR number, the branch, and the commands from step 1 to
  read the changes;
- the chosen scanners, by following `.claude/commands/security-scan-changed.md` with the
  arguments `only: <the chosen scanners>`.

Wait for all of them.

## Step 4: Fix and save

1. Fix every finding that is clearly right. Ask the owner about behaviour changes and judgement
   calls before changing them. Keep a finding you think is wrong, with one line on why.
2. Run `npm test`, `npx tsc --noEmit` and `npm run lint` if code changed; the browser and
   database tests too if the changed code is covered by them and the local Supabase can start.
3. Save one report as `docs/reviews/pr-<number>-<topic>.md` in the usual layout: PR link,
   branch, date, which checks ran and why (and which were skipped), verdict, numbered findings
   with what was done about each, and the checks after the fixes. Commit and push.

## Step 5: Ask to merge

Tell the owner, short:
- what ran and what was skipped, and why;
- the findings and what was done, and anything waiting for them;
- the Playwright usability tests this change needs (or "none: no app behaviour changed");
- the link, and "Shall I merge it?"

Never merge without the owner's yes.
