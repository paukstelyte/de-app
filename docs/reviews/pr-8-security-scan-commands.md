# ai-code-reviewer report: PR #8

- **Pull request:** https://github.com/paukstelyte/de-app/pull/8 — "Add the security scan commands and their scanner agents"
- **Branch:** `chore/add-security-scan-commands` → `main`, reviewed at commit `ad35c1b`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...chore/add-security-scan-commands` before merging.
- **Scope:** 5 files copied from the course folder: `.claude/commands/security-scan.md`, `security-scan-changed.md` and the Supabase, Next.js and Vercel scanner agents. No app code.

## Verdict
Approve, with one Warning to be aware of. The five files are byte-identical to the course originals and contain nothing from another project. The scanners rely on `Bash` plus written rules for read-only behaviour, so their safety is a promise, not something the tools enforce.

## Findings

### Critical
None.

### Warning
1. **The Supabase scanner preloads two skills the repo doesn't have.** Its frontmatter lists `supabase` and `supabase-postgres-best-practices`, and its body cites reference files from them. They are not in `.claude/skills/`. They may exist at user or course level, but the repo can't rely on that. Without them the agent runs without its Row Level Security reference.
2. **Read-only is enforced only by prose.** All three agents have `tools: Read, Grep, Glob, Bash`, and `.claude/settings.json` has `"permissions": {}`, so nothing blocks `vercel deploy`, `supabase db push` or `cat .env.local`. The written rules are explicit and sound. For a real guarantee, deny rules could be added to `settings.json` (for example for `vercel env pull`, `vercel deploy`, `supabase db push` and reading `.env*`), checked against how the e2e tests read `.env.e2e`.
3. **Dead fallback text.** `security-scan.md` falls back to an agent called `security-auditor` that doesn't exist in this repo. It never fires, because the scanners now exist.

### Suggestion
- The Supabase scanner can run `npx supabase db query --linked`, which can run any SQL; "select only" is prose. It reads the project ref at run time, so no other project's ref is baked in.
- The Vercel scanner may check whether a local secret appears in git history by piping the value into `grep -c`. It reports counts only and says never to `cat` or `echo` env files, but a careless command could still print one. The bullet (`vercel-security-scanner.md`, lines 94-95) could be removed for a strict "never reads secret files" claim.
- The scanners and `ai-code-reviewer` are different in scope (security versus code quality). No names collide and nothing is shadowed.

### Noted outside this PR
The local, uncommitted edit to `CLAUDE.md` (not on this branch) has a stray unmatched backtick after `/security-scan-changed` and changes the flashcard level line to "A1–C2", which contradicts the seed data (A1–B2). Neither affects this PR.

### Checks that passed
1. `cmp` of all five files against the course folder: identical.
2. No `/Users/`, `.supabase.co`, `.vercel.app`, project names or ref ids in the files; only generic placeholders.
3. No write, deploy or secret-reading steps appear as instructions; every such command appears only in "never do this" lists. Permitted commands are GET calls via `vercel api`, `vercel env ls`, `vercel ls`, `curl -I`, `git log`, `gh repo view` and select queries.
4. All three agents and both commands say never to print secret values and to report names or counts only.
5. The committed `CLAUDE.md` already describes these two commands, so this PR delivers what it promises. No name collision with the existing agent or skills.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | No change. The files are copied unchanged on purpose. The scanners ran on PR #7's changes and worked (their reports are in `pr-7-upload-allowance.md`). Adding the two skills would be a separate decision (CLAUDE.md says to ask before installing). |
| Warning 2 | Not applied here: it means changing permission settings, which is the owner's decision. Raised with the owner. |
| Warning 3 | No change: harmless dead text in files copied unchanged. |
| Suggestions | No change; noted. |
