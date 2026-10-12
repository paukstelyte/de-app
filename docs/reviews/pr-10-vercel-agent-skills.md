# ai-code-reviewer report: PR #10

- **Pull request:** https://github.com/paukstelyte/de-app/pull/10 — "Add the Vercel agent skills"
- **Branch:** `chore/add-vercel-agent-skills` → `main`, reviewed at commit `9e5438f`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...chore/add-vercel-agent-skills` before merging. It ran `npm test`, lint and `tsc`.
- **Scope:** 310 files, about 39,000 lines of third-party skill files (`.agents/skills/`, 9 symlinks in `.claude/skills/`, `skills-lock.json`) and a 2-line change to `eslint.config.mjs`. The reviewer did not read every line: it read the deploy scripts, listed the bundled zip, read the scripts of `vercel-optimize` at a high level, and searched all markdown for injection-style text.
- **Course-requirement checks requested:** no new packages without asking, secrets only in env files, branch and PR for changes, OpenRouter server-side only.

## Verdict
Safe to merge, with warnings. No malicious content and no prompt injection found. The 4 skills it compared are byte-identical to the global copies, and the other 5 are pinned in `skills-lock.json`. The issues are policy and hygiene, not code defects.

## Findings

### Critical
None.

### Warning
1. **The deploy skill's no-sign-in fallback uploads the project to a third-party endpoint.** `deploy-to-vercel/resources/deploy.sh` (and `deploy-codex.sh`, which differs only in the URL) tars the folder, leaving out `node_modules`, `.git`, `.env` and `.env.*`, and posts it to a Vercel-run endpoint for an unauthenticated public preview. Env files (`.env.local`, `.env.e2e`) are excluded, but everything else in the folder would be sent. It is only reached as a last resort, when the Vercel CLI is neither installed nor signed in. SKILL.md does not tell the agent to ask first (only `git push` is gated), and `vercel deploy -y` / `vercel link -y` run without a confirmation. The app is already deployed through git integration, so the fallback is never needed here.
2. **`vercel-cli-with-tokens` tells the agent to read `.env` files**, running `grep -i 'vercel' .env` and `printenv | grep -i vercel`. That pattern also matches other lines containing "vercel" and would print them into the transcript. It does not pass the token with `--token` (the safe pattern). It also tells the agent to run `npm install -g vercel` without asking. Treat the skill as opt-in.
3. **`web-design-guidelines` and `writing-guidelines` fetch their rules when they run**, from `raw.githubusercontent.com/vercel-labs/.../main/command.md`. That content is not pinned and is not covered by the lock-file hash. Low risk today (first-party Vercel repos), but a compromise of those repos would feed instructions into a session.
4. **The 9 skills now load twice**, from the project and from `~/.claude/skills`, and the pinned hashes and global copies can drift apart.

### Suggestion
1. Consider not committing `.agents/` (299 files, 2.1 MB, about 39k lines in a public repo of a small app, including a redundant 11 KB `Archive.zip`): ignore it and commit only `skills-lock.json`, or rely on the global install. If it stays committed, say in the PR that the code is third-party.
2. The symlinks are relative: they break on Windows without symlink support, and if `.agents/` is later ignored.
3. The eslint ignore is correct and minimal. `tsc` passes, but `tsconfig.json` would pick up `.agents/**/types.d.ts`, so adding `.agents` to `exclude` is cheap insurance.
4. `vercel-react-native-skills` is irrelevant to this web app, and `vercel-react-view-transitions` and `vercel-composition-patterns` only marginally so; they add context cost for no value.

### What `vercel-optimize` does (89 `.mjs` files)
A local performance-audit pipeline. No `fetch`, `http` or `https` anywhere; the only network use is through the `vercel` CLI, run with `execFile` (no shell) for read-only commands (`whoami`, `metrics`, GETs to `/v2/teams`, `/v9/projects`, `/v1/observability/...`). It does not read `.env` files or tokens, and it redacts `VERCEL_TOKEN=` values from output. It writes only to paths the caller gives it. It can issue many metric queries against the Vercel account, throttled.

### Checks that passed
1. All 9 symlinks resolve.
2. `skills-lock.json` has 9 entries with source, path and SHA-256 each (hashes not recomputed).
3. `npm test` 129/129, `npm run lint` clean, `npx tsc --noEmit` exit 0.
4. The only non-skill change is the 2-line `eslint.config.mjs` ignore; `CLAUDE.md` is not in the branch.
5. `Archive.zip` (listed, not extracted) holds only the two deploy scripts and SKILL.md plus `__MACOSX/` entries; nothing sensitive.
6. No injection-style text found (a search for "ignore previous", "disregard", "without asking", `curl | sh`, `base64`, "exfil" had no real hits). The skills say to ask before pushing and to default to preview deploys.
7. No `package.json` or lockfile change, so no new project packages.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | **Open, for the owner to decide.** The reviewer suggests a project permission rule that asks before `deploy.sh`, `deploy-codex.sh` and `vercel deploy`. Changing permission settings is not part of this PR; it is a separate decision. Until then, the deploy skill should not be used in this project without asking. |
| Warning 2 | Noted in the PR. The Vercel CLI is installed and signed in, so the skill's token path is not needed. Treat the skill as opt-in. |
| Warning 3 | Noted in the PR. Accepted: first-party sources. |
| Warning 4 | Noted in the PR. The owner chose to commit the skills to the project, so they are kept. |
| Suggestion 1 | Not applied: committing `.agents/` was the owner's choice; the PR now says the code is third-party. |
| Suggestion 2 | No change, same reason. |
| Suggestion 3 | No change: `tsc` passes. Can be added if `.agents` ever gains a `.ts` file that breaks it. |
| Suggestion 4 | No change; unused skills cost context but nothing else. Removing three of the nine is easy (`git rm` the symlink and folder, and the entry in `skills-lock.json`). |

Re-run after this record was added: no code changed, so lint, `tsc` and tests are as above.
