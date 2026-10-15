# ai-code-reviewer report: PR #29

- **Pull request:** https://github.com/paukstelyte/de-app/pull/29 — "Add /pre-merge: only the checks the changed files need"
- **Branch:** `pre-merge-skill` → `main`
- **Date:** 2026-10-15
- **Checks run:** chosen by `/pre-merge` itself: the reviewer only (instructions and prose changed; no app, database or deployment files). No security scanners.

## Verdict
One critical finding: the selection table could skip security checks some files need. Fixed, with the other coverage gaps. "First matching row per file, every ✓ across files" was confirmed consistent.

## Findings and what was done

### Critical
1. **`lib/supabase/**` got only the Supabase scanner**, but it holds the login gate (`PROTECTED_PATHS`) and the secret-key client (`server-only`), which the Next.js and Vercel scanners check. *Fixed:* its own row with all three scanners.

### Warning
2. **Env vars are read in app code, but Vercel only ran for deployment files.** *Fixed:* any non-prose file that reads `process.env` adds the Vercel scanner (this also covers test files, which run in the Vercel build).
3. **`public/*.svg` matched the Prose row** (images) and got no checks; an SVG can carry script. *Fixed:* only images under `docs/` count as prose.
4. **The `only:` option sat after the "launch all three" text,** and the Advisor section and Scanners line had no "not run" state. *Fixed:* folded into step 2 of `security-scan-changed` (decide first, names `supabase`, `nextjs`, `vercel`); the Advisor section says "Not run" and the Scanners line marks scanners that weren't chosen.
5. **An empty `only:` could be read as "all three".** *Fixed:* with no scanner chosen, the reviewer runs alone.
6. **The reviewer brief dropped the CLAUDE.md AI and security rule checks** the README promises. *Fixed:* the brief includes them, plus permission and hook changes in `.claude/settings*.json`.
7. **Two definitions of "prose-only"** (CLAUDE.md and the skill) already differed. *Fixed:* CLAUDE.md points to the skill's table.
8. **`AGENTS.md` counted as prose.** *Fixed:* it and any `CLAUDE.md` get the reviewer.

### Suggestion
9. Test files run in the Vercel build. *Covered* by the `process.env` rule.
10. `.claude/settings.json` changes get only the reviewer. *Covered:* the brief asks it to check permissions and hooks.
11. Three rows gave the same result. *Merged* into one "Reviewer only" row.
12. Config files like `tsconfig.json` fall to "Anything else" (all checks): *kept*, harmless. CLAUDE.md's scan rule said "every feature branch": *reworded* to "every pull request whose changed files need it".
13. Deleted files are listed differently than in `security-scan-changed`. *Kept:* the skill classifies deleted files too, which is what matters for picking checks.

## Checks after the fixes
No code changed, so no tests apply. Re-checked against PRs #20, #22, #24 and #25: the table still picks at least the scanners run by hand.
