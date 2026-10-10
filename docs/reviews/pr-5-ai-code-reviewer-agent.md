# ai-code-reviewer report: PR #5

- **Pull request:** https://github.com/paukstelyte/de-app/pull/5 — "Add the ai-code-reviewer agent to the repo"
- **Branch:** `chore/add-ai-code-reviewer-agent` → `main`, reviewed at commit `b6cd404`
- **Date:** 2026-10-10
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on the PR diff before merging
- **Scope:** 2 files: the new `.claude/agents/ai-code-reviewer.md` and one README paragraph

## Findings

### Critical
None.

### Warning
1. **The README said more than the agent file shows.** "For each PR it was also asked to check the course's AI and security rules" isn't in the agent file, which doesn't mention security or the course. Those checks were added in each review request, so a reader can't see them from the agent file alone.

### Suggestion
1. The agent's tools include Bash, so its "don't edit" rule is an instruction, not something enforced. That's fine: it needs Bash for `git diff`.
2. The agent runs plain `git diff`, which only shows uncommitted changes. For a PR the caller has to point it at `main...<branch>`, as was done for every PR here.

### Checks that passed
- The agent file is byte-identical to the original in the course folder.
- The README link `.claude/agents/ai-code-reviewer.md` resolves, and the existing report links still do.
- The README's summary of the agent (fresh context; dead code, duplication, over-engineering, silent behaviour changes; Critical / Warning / Suggestion) matches the file.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Fixed: the README now says the course's AI and security rules were listed in each review request, and that the reports record those checks (see the "Course-requirement checks" sections of the PR #1 and #2 reports, and "Checks requested" in PR #4). |
| Suggestion 1 | No change, as the reviewer advised. |
| Suggestion 2 | No change: the review requests already name the branch range. |
