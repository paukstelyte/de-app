# ai-code-reviewer report: PR #12

- **Pull request:** "Refuse npm package versions published less than 7 days ago" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `chore/npm-min-release-age` → `main`, reviewed at commit `a809a51`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...chore/npm-min-release-age` before merging. It ran npm dry runs; it did not install anything.
- **Scope:** a new project `.npmrc` with `min-release-age=7`, for the CLAUDE.md rule "Configure this project so npm refuses to install any package version published less than 7 days ago."

## Verdict
Approve. `min-release-age=7` is the right key and value (days, npm 11.19), lockfile builds don't break, and nothing conflicts with it. The rule's wording and its gaps should be written down.

## Findings

### Critical
None.

### Warning
1. **The CLAUDE.md rule promises more than npm enforces.** Versions already pinned in `package-lock.json` are never re-checked: `npm ci --dry-run` and `npm install --dry-run` pass even with a 10-year window. The filter only applies when npm resolves something new (`npm install <pkg>`, `npm update`, regenerating the lockfile). The rule should say "resolve" (new or updated versions), not "install".
2. **Global installs and anything run outside the project folder are not covered.** `npm i -g` skips the project `.npmrc`, and outside the folder the setting is `null`. `npx` / `npm exec` run from the project root should pick it up (not run live to confirm). Covering the rest needs the setting in the user `~/.npmrc` (`npm config set min-release-age 7`).
3. **Vercel's npm version is not verified.** No `engines`, `packageManager` or install override exists, so Vercel uses its default Node and npm. An npm too old to know the key treats it as a warning ("Unknown project config ..."), not an error. Because the lockfile is honoured either way, the deploy is unaffected in both cases; the worst case is a log warning.

### Suggestion
1. Document what an `ETARGET` "No matching version found ... with a date before ..." error means, how to respond (wait, pin an older version, or exempt one package with `min-release-age-exclude[]=<pkg>` after review), and that `npm audit fix` can also refuse a too-new fix.
2. Never set `before` in the same `.npmrc`: an explicit `before` (or `--before`, `--min-release-age=0`, `npm_config_before`) overrides `min-release-age`. A comment line prevents this.
3. Optional: an `engines.npm >= 11.19` or `packageManager` field, so local and Vercel npm match. Without `engine-strict` it only warns.

### Checks that passed
1. The key, its unit (days) and its conversion to `before = now - days` are correct for npm 11.19.0.
2. No `before` is set anywhere (`npm config ls -l`: `before = null`, `min-release-age = 7`, `min-release-age-exclude = []`).
3. `npm ci --dry-run` and `npm install --dry-run` exit 0 with the current lockfile, so existing builds can't break. `npm install --dry-run vercel@63.1.2` (published 3 days ago) fails with `ETARGET`, as intended.
4. `.npmrc` holds no secrets or auth tokens and is safe to commit.
5. Minimal one-file change.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | `.npmrc` and README now say what is covered (new or updated versions; the lockfile is not re-checked). Rewording the CLAUDE.md rule itself is raised with the owner (CLAUDE.md is the owner's file). |
| Warning 2 | README states the gap. Adding the setting to the user `~/.npmrc` (global installs) is raised with the owner: it changes their machine-wide npm settings. |
| Warning 3 | Accepted: no deploy risk. Check the next Vercel build log for an "Unknown project config" line. |
| Suggestion 1 | Done: a paragraph in README "Scripts and tests". |
| Suggestion 2 | Done: a comment in `.npmrc`. |
| Suggestion 3 | Not applied: optional, and it would only warn. |
