# ai-code-reviewer report: PR #28

- **Pull request:** https://github.com/paukstelyte/de-app/pull/28 — "Add the /docs-sync skill and name it in the docs rule"
- **Branch:** `docs-sync-skill` → `main`
- **Date:** 2026-10-15
- **Reviewer:** the `ai-code-reviewer` subagent, on the changes since the branch split off `origin/main`. Before the review, a fresh agent ran the skill on this branch as a trial; its fixes are in the PR.
- **Security scan:** not run: the PR changes instructions and docs only.

## Verdict
No critical issues. Every path the skill names exists, `next typegen` is in the installed Next.js, it refuses to run on main, never installs anything, and doesn't contradict the other agents or commands.

## Findings and what was done

### Warning
1. **The commit could sweep in the feature's own unfinished edits.** *Fixed:* stage only the files the skill edited or deleted, never `git add -A`; the CLAUDE.md rule is the OK for this commit.
2. **"Put it back or fix the caller" invited rewriting live code** after a wrong deletion. *Fixed:* put it back (it wasn't unused); never change its users to make a removal work.
3. **Grep alone misses things called without an import** (Next.js files and exports, server actions, Tailwind classes built from strings, `e2e/`, `scripts/`). *Fixed:* never removed as unused; listed for the owner if in doubt.

### Suggestion
1. "Migrations already applied" can't be checked. *Changed* to "any migration already on main".
2. The already-run scripts weren't protected. *Added* `scripts/add-ids-and-rules.mjs`, `scripts/levels/*`, `scripts/c-levels/*` to the records.
3. In-app text was missing from the docs table. *Added* the "how to use" copy, `/rules` and topic intros.
4. The "major change" definition is in both the skill and CLAUDE.md. *Kept:* the owner approved the CLAUDE.md wording; the skill's description needs it to start on its own.
5. The definition may fire on most branches. *Kept* (owner's wording); step 3 ends early when nothing was removed, so the run stays short.
6. `/improve-exercises` goes straight to the reviewer. *Left for the owner:* exercise-content PRs rarely change docs, and the skill never edits exercise data.
7. The worktree case didn't say whether to stop. *Fixed:* stop and say so.
8. The base ref differed from the reviewer's. *Fixed:* both use `origin/main`.
