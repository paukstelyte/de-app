# ai-code-reviewer report: PR #27

- **Pull request:** https://github.com/paukstelyte/de-app/pull/27 — "ai-code-reviewer: review the whole branch, not just uncommitted edits"
- **Branch:** `reviewer-whole-branch` → `main`
- **Date:** 2026-10-15
- **Reviewer:** the `ai-code-reviewer` subagent, on `git diff $(git merge-base main HEAD)`. It tested the edge cases in a scratch repo (staged, untracked, main moved on, run on main, a missing branch).
- **Security scan:** not run: the PR changes the reviewer's instructions only.

## Verdict
No critical issues. Diffing from where the branch split off main is the right choice: it covers commits and uncommitted edits, and leaves out anything main gained later. On main itself it shows only uncommitted edits, like the old `git diff`.

## Findings and what was done

### Warning
1. **A failed `git merge-base` silently shrank the review to uncommitted edits** (`$(...)` expanded to nothing, so the command ran as plain `git diff`). *Fixed:* the steps run one at a time, and the agent stops if finding the split point fails.
2. **`git status --short` shows a new folder as one line**, not the files inside it. *Fixed:* `git ls-files --others --exclude-standard` lists each new file.
3. **Local `main` can fall behind GitHub**, so the review could include already-merged commits. *Fixed:* it runs `git fetch origin main` and uses `origin/main`.

### Suggestion
1. Say what happens on main. *Done.*
2. Step 2 said "Review the diff", but new files aren't in the diff. *Changed* to "Review these changes".
3. Branches cut from another feature branch that was later squash-merged would re-show merged work. *Not done:* every branch here starts from main.
4. `$(...)` may trigger a permission prompt. *Fixed* by the separate steps (same change as Warning 1).

## Checks after the fixes
On this branch: `git fetch origin main`, `git merge-base origin/main HEAD` (4077d0f, main's latest), and `git diff` from there shows the agent change; `git ls-files --others` lists the new report file before it was committed.
