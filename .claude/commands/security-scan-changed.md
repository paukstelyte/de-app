---
description: Security scan of only the files changed on this branch vs main — runs the Supabase, Next.js and Vercel scanners in parallel and merges their findings by severity. Read-only.
---

Run a security scan limited to the files changed on the current git branch, using three
security subagents at the same time, then merge their findings into one report. $ARGUMENTS

## Rules

- Report only. Neither you nor the scanners may edit, create or delete files, change Vercel or
  Supabase settings, or run anything that writes (installs, deploys, migrations, git commits,
  database writes). Read-only commands only.
- Never print secret values in the report.

## Step 1: Find the changed files

Work in the git repository of the project being scanned (run these from its root; if the
current directory isn't inside a repo, ask which project to scan).

1. `git rev-parse --abbrev-ref HEAD` — the current branch. Find the main branch: `main`, else
   `master`, else `origin/main`.
2. `BASE=$(git merge-base <main> HEAD)` — where this branch split off.
3. Changed files = the union of:
   - `git diff --name-only --diff-filter=ACMR $BASE` (committed and uncommitted changes to
     tracked files since the branch split off)
   - `git ls-files --others --exclude-standard` (new files not yet committed)
4. List deleted files separately (`git diff --name-only --diff-filter=D $BASE`); they can't be
   scanned, but note them in the report.
5. Also note the commits being scanned: `git log --oneline $BASE..HEAD`.

If the branch is the main branch itself, or there are no changed files, say so and stop: there
is nothing to scan.

## Step 2: Dispatch all three scanners in parallel

In a **single message**, launch these three subagents with the Agent tool so they run at the
same time:

1. `supabase-security-scanner`
2. `nextjs-security-scanner`
3. `vercel-security-scanner`

Give each one: the project root path, the branch name, the base commit, the commit list, and
the full list of changed (and deleted) files. Tell each one, word for word:

"Focus only on these changed files. Read other files only when you need them to understand a
changed one (for example, to see which component receives a prop, what a helper checks, or a
table a new migration builds on). Report only problems that are in, or caused by, these
changes — not pre-existing issues elsewhere. Report only. Do not change any code, settings or
data. Return findings grouped as Critical, High, Medium and Low, each with location, risk,
what could go wrong and a fix, plus your 'Checked and fine' and 'Not checked' lists."

Add for each scanner:
- **Supabase:** focus on changed migrations, `supabase/config.toml`, and changed code that uses
  Supabase clients, RPCs or keys. It may run read-only queries against the live database to
  check the tables, policies, grants and functions those migrations create.
  Always run its check 6 (the Security Advisor checks) for the whole project: it is quick, and
  the report has a "Supabase Security Advisor" section.
- **Next.js:** focus on changed pages, layouts, server actions, route handlers, `proxy.ts`,
  client components and env var usage in the changed files.
- **Vercel:** focus on how the changes affect the deployment: changed `next.config.*`,
  `vercel.json`, `proxy.ts`, `.gitignore` and `.env.example`; any env var the changed code reads
  that must be set (and scoped / marked Sensitive) in Vercel; and secrets committed in this
  branch's commits only (`git log -p $BASE..HEAD`, printing commit hashes and file names only).

If one of the three subagents doesn't exist, run the others, say which one was missing, and
mark that part "Not checked". Wait until all of them have finished before writing the report.

## Step 3: Merge into one report

1. Collect every finding.
2. **Remove duplicates**: findings describing the same underlying problem in the same place
   are listed once, noting which scanner(s) flagged it, e.g. *(flagged by: Supabase, Next.js)*.
   If they disagree on severity, use the higher one and mention the disagreement briefly.
3. Don't add findings of your own, and don't drop a scanner's finding unless it's a
   duplicate. If you think a finding is wrong, keep it with a one-line note saying why.

## Report format

```
# Security scan of changed files: <project>, <branch> vs <main>, <date>

Scanned: <n> changed files across <n> commits (+ <n> uncommitted)   Deleted: <n>
Scanners: Supabase ✓, Next.js ✓, Vercel ✓   (mark any that failed or were missing)
Totals: <n> critical · <n> high · <n> medium · <n> low

## Critical
### 1. <short title>  (flagged by: <scanner(s)>)
- Location: <file:line or setting>
- Risk: <category>
- What could go wrong: <plain language>
- Fix: <one or two sentences>

## High
...
## Medium
...
## Low
...
```

Write "None" under any empty severity. Number findings continuously so they can be referred
to ("fix #3").

After the severity sections, add:

- **Files scanned:** the changed files, one per line (deleted ones marked as such).
- **Supabase Security Advisor:** the Supabase scanner's Advisor section as it is (one line per
  dashboard item: real problem → finding #N, or intended and why), so the report can be matched
  with the dashboard's Security Advisor list.
- **Checked and fine:** one combined, de-duplicated list from all three scanners.
- **Not checked:** anything a scanner couldn't verify, with the reason.
- **Suggested next steps:** at most three lines, most urgent first, pointing to finding numbers.
