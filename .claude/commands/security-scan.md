---
description: Full security scan — runs the Supabase, Next.js and Vercel security scanners in parallel and merges their findings into one report by severity. Read-only.
---

Run a full security scan of the current project using three security subagents at the same
time, then merge their findings into one report. $ARGUMENTS

## Rules

- This is a report-only scan. Neither you nor the scanners may edit, create or delete files,
  change Vercel or Supabase settings, or run anything that writes (installs, deploys, migrations,
  git commits). Read-only commands only.
- Never print secret values in the report.

## Step 1: Dispatch all three scanners in parallel

In a **single message**, launch these three subagents with the Agent tool so they run at the
same time (not one after another):

1. `supabase-security-scanner`: Supabase security of the whole project (Row Level Security on
   every table, policies, grants, security-definer functions, key handling, auth settings).
2. `nextjs-security-scanner`: Next.js data security of the whole app (secrets behind
   `NEXT_PUBLIC_`, data sent to client components, auth and ownership checks in server actions
   and route handlers, data access structure).
3. `vercel-security-scanner`: the Vercel deployment layer (env var scoping and Sensitive flags,
   preview Deployment Protection, deployed security headers, committed secrets not rotated).

Give each one the project root path, tell it to scan the whole project, and repeat to each:
"Report only. Do not change any code, settings or data. Return findings grouped as
Critical, High, Medium and Low, each with location, risk, what could go wrong and a fix, plus
your 'Checked and fine' and 'Not checked' lists."

If `supabase-security-scanner` doesn't exist in this project, use `security-auditor` for the
Supabase part instead and say so in the report. It groups findings as Critical / Warning /
Suggestion: keep Critical, place each Warning in High or Medium by its impact, and treat
Suggestion as Low.

Wait until all three have finished before writing the report.

## Step 2: Merge into one report

1. Collect every finding from the three scanners.
2. **Remove duplicates.** Treat findings as the same when they describe the same underlying
   problem in the same place (same file/setting and same root cause), even if worded
   differently. List each one once and note which scanner(s) flagged it, e.g.
   *(flagged by: Next.js, Vercel)*. If they disagree on severity, use the higher one and
   mention the disagreement in one short clause.
3. Don't add findings of your own, and don't drop a scanner's finding unless it is a duplicate.
   If you believe a finding is wrong, keep it and add a one-line note saying why.

## Report format

```
# Security scan: <project name>, <date>

Scanners: Supabase ✓, Next.js ✓, Vercel ✓   (mark any that failed or were substituted)
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

Write "None" under any empty severity. Number findings continuously across sections so they
can be referred to ("fix #3").

After the severity sections, add:

- **Checked and fine:** one combined, de-duplicated list from all three scanners.
- **Not checked:** anything a scanner couldn't verify (e.g. not logged in to the Vercel CLI,
  protected preview), with the reason.
- **Suggested next steps:** at most three lines, most urgent first, pointing to finding numbers.
