# ai-code-reviewer report: PR #13

- **Pull request:** "Add permission rules and update CLAUDE.md working rules" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `chore/project-rules` → `main`, reviewed at commit `12641df`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...chore/project-rules` before merging. It did not read env files or run any deploy or migration command.
- **Scope:** `.claude/settings.json` (new permission rules) and `CLAUDE.md` (the owner's edits plus two fixes).

## Verdict
Mergeable after small fixes. Rule syntax is valid and nothing blocks `.env.e2e`, `.env.example`, `e2e/lib.sh` or the everyday Supabase and Vercel commands. Three things fell short of the intent: the deploy rules missed common deploy commands, the `.env.local` denies are easy to get around, and `CLAUDE.md` mentions a project `.npmrc` that this branch doesn't contain.

## Findings

### Critical
1. **`CLAUDE.md` says the 7-day rule is "set in `.npmrc`", but no `.npmrc` is on this branch.** It is added by PR #12 (`chore/npm-min-release-age`), which is not merged yet.

### Warning
1. **A requirement was dropped:** "At least two pages, including one detail page with its own address/route" is gone from General Requirements (an empty line is left), with no mention.
2. **"Before merging, suggest needed usability and security tests" became "usability tests with Playwright"**, dropping security tests; the full scan also moved from "monthly, or before a big release or production deploy" to "weekly", losing the before-deploy trigger.
3. **Level wording:** General Requirements says every flashcard word has a level A1–C2, while the overview and seed-data sections say the deck is A1–B2 (true today). Read as a requirement, A1–C2 is not met yet.
4. **Deploy `ask` rules missed real deploy paths:** bare `vercel`, `vercel --prod`, `vercel -y`, `vercel redeploy`, `vercel promote`, `npx -y vercel ...`, `npx vercel@latest ...`, an absolute path to the skill script, and merging or pushing to `main` (Vercel's git integration deploys production).
5. **Schema `ask` rules missed** `npx -y supabase db push`, `npx supabase@latest db push`, `supabase db reset --linked` and `supabase migration up/repair --linked`. `npx supabase db query --linked "<SQL>"` can also change the live database; it stays allowed because the e2e scripts and README use it.
6. **The `.env.local` Bash denies are a deterrent, not a block.** Prefix rules only catch the listed forms; `cat ./.env.local`, `sed`, `awk`, `node -e`, `python3 -c`, `grep KEY .env*`, or sourcing the file and then running `env` get through. A real block needs the sandbox `denyRead` or a hook, which would also break the intended `node --env-file=.env.local` use.
7. **`Read(./.env.local)` is relative to the current working directory**, so it misses the file when the session starts in a subfolder. `Read(**/.env.local)` covers every case.

### Suggestion
- A trailing space after "Playwright" and an extra blank line before `## Do Not` in `CLAUDE.md`.
- `Bash(supabase db push*)` also prompts for `--dry-run`: harmless.
- Commands prefixed with a variable assignment (`VAR=... npx supabase db push`) may not match; worth one manual test.

### Checks that passed
1. The `Bash(prefix*)` form and the `ask` / `deny` keys are valid; `*` matches across `/` and spaces.
2. Compound commands are split on `|`, `&&`, `||`, `;` and each part is checked, so `echo y | npx supabase db push` hits the `ask` rule.
3. No accidental matches on `.env.e2e`, `.env.example`, `e2e/lib.sh`, `node --env-file=.env.local`, `set -a; . ./.env.local`, `npx supabase db query`, `npx supabase migration list`, `vercel ls` or `vercel env ls`.
4. The stray backtick is fixed, the security-scan line reads cleanly, and the npm rule doesn't conflict with "ask before installing packages".
5. The rest of `CLAUDE.md` (AI rules, flashcard rules, tech stack) is unchanged.

## What was done about it

| Finding | Action |
|---|---|
| Critical 1 | No change to the text: merge PR #12 (which adds `.npmrc`) before this PR. Stated in the PR description. |
| Warnings 1 and 2 | Not changed: these are the owner's own edits. Raised with the owner to confirm or restore. |
| Warning 3 | Not changed: the owner chose A1–C2 as the goal and asked for real C1/C2 words, which are being designed now. The overview and seed-data sections describe today's deck and will be updated when the words are added. |
| Warning 4 | Fixed: `ask` now also covers bare `vercel`, `vercel --prod`, `vercel -y` / `--yes`, `vercel redeploy`, `vercel promote`, `npx vercel*` and `npx -y vercel*`. Merging to `main` stays unguarded by a rule: merges only happen when the owner asks. |
| Warning 5 | Fixed: `ask` now also covers `db reset`, `migration up`, `migration repair` (with and without `npx`), `npx -y supabase*` and `npx supabase@*`. `db query` stays a known gap. |
| Warning 6 | Accepted and stated plainly: the `.env.local` rules are a deterrent. A hard block would break the intended `--env-file` use. |
| Warning 7 | Fixed: added `Read(**/.env.local)`. |
| Suggestions | Fixed the trailing space and blank line; the rest noted. |
