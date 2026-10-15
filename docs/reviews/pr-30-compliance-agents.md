# ai-code-reviewer report: PR #30

- **Pull request:** https://github.com/paukstelyte/de-app/pull/30 — "Add the gdpr-compliance and eu-ai-act-compliance agents"
- **Branch:** `gdpr-compliance-agent` → `main`
- **Date:** 2026-10-15
- **Checks run:** chosen by `/pre-merge`: the reviewer only (agent instructions and prose changed). Two passes: commit 04de0b8 (gdpr-compliance) and commit 07a1a61 (eu-ai-act-compliance), added after the first pass had started.
- **Scope:** both agents' instructions are the owner's text, unchanged. Claude wrote the gdpr agent's frontmatter and the two README paragraphs; findings on the owner's text are notes for the owner.

## Verdict
No critical issues. Both agents' frontmatter is valid and matches the other agents; the README paragraphs are accurate; the CLAUDE.md AI and security rules don't apply (no code, secrets, tables or packages).

## Findings and what was done

### Warning
1. **The PR grew during the first review.** *Done:* a second pass reviewed the new commit; this report covers both.
2. **The EU AI Act agent has `Bash`, with only "Do not edit any files" as the guard** (the gdpr agent has read-only tools). Low risk: writes still need permission. *Left for the owner* (owner's frontmatter).

### Notes for the owner (owner's text, unchanged)
- **GDPR:** the criteria are generic ("message contents", "analytics" don't exist here; uploaded documents, the text read from them and Google profile data do).
- **GDPR:** the logging criterion can only be checked in code; Vercel, Supabase and OpenRouter logs and retention need a check in their dashboards.
- **GDPR:** account deletion must also cover the `learning-uploads` storage files and the upload-counter rows. `deleteAccount` logs a failed storage clean-up and still deletes the user (files are already deleted after every analysis, so the bucket is normally empty).
- **EU AI Act:** PASS/FAIL only, but DE-app has no chatbot and no image, audio or video generation; an "N/A, with reason" option would stop forced answers.
- **EU AI Act:** the AI-content criterion is broader than Article 50 (machine-readable marking by providers; deployer labelling for text published on matters of public interest). Whether the topic suggestions are in scope is a call for the owner or a lawyer.
- **EU AI Act:** 2 August 2026 has passed, so it can't be a "fix before" deadline; the 2 December 2026 date couldn't be confirmed (possibly the Digital Omnibus proposal) and needs a source and an "as of" date.

### Suggestion
- EU AI Act: point the agent at code signals (`openrouter`, model slugs, `lib/learning/analyse.ts`) and say a disclosure must say "AI" in plain words; the upload box and document list name the model ("Gemini 2.5 Flash Lite … via OpenRouter") but not the word "AI".
- EU AI Act: the description doesn't say "not legal advice" (the body does).
- Both: no rule says when to run them; a CLAUDE.md line (e.g. before release) is optional.

---

# Pre-merge checks: GDPR and AI Act fixes (commit 4fbf5d8)

After the two agents were added, they were run on the app; the owner chose which of their suggestions to implement, and they were added to this PR.

- **Checks run:** chosen by `/pre-merge`: the reviewer and all three security scanners (app code, code using Supabase, and `lib/learning/analyse.ts`, which reads env vars).
- **Results:** no critical, high or medium findings from any of them. Security Advisor: only the two intended SECURITY DEFINER warnings. Config drift: none. No secrets in the branch's commits. `google/gemini-2.5-flash-lite` is on OpenRouter's zero-data-retention list.

## Findings and what was done

### Warning (reviewer)
1. **"Upload counts are removed once more than 2 days old" was only true when someone uploads.** *Fixed:* the privacy page says they're cleared out at the next upload by anyone.
2. **"Everything we store about you" overclaimed** (sign-in IPs sit in the auth provider's logs). *Fixed:* "Everything saved in your account", also in CLAUDE.md.
3. **Privacy claims that depend on vendors.** *Fixed:* "expire on those providers' own schedules" (not "short"); the transfer paragraph now covers Google as well as OpenRouter. *For the owner:* keep OpenRouter's "input/output logging" setting off (added to `docs/todo.md`); the 1-hour Vercel log claim matches the Hobby plan.
4. **The new "deletion stops" path has no test.** *Not done:* the local setup can't make storage fail on purpose; recorded in `docs/todo.md`.
5. **A user whose deletion keeps failing had no way out.** *Fixed:* the message adds "or write to <contact email>".

### Low (scanners)
- **The OpenRouter error message could still quote the document** (reviewer, Next.js, Vercel). *Fixed:* only the status and error code are logged.
- **"Servers in Dublin" didn't mention edge servers** (Vercel). *Fixed:* the app runs in Dublin; requests first pass through Vercel's nearest edge server, which may be outside the EU.
- **No rate limit on Download my data** (Next.js). *Kept:* users can only read their own rows; add a throttle if abused.
- **Leftover upload files aren't listed in the export** (Supabase). *Kept:* files are deleted after every analysis, so normally there are none.

### Suggestion (reviewer)
- `learning_upload_usage` paging now orders by `id`. *Done.*
- `supabase/config.toml` `max_rows` has a comment tying it to `PAGE_SIZE`. *Done.*
- The guest test asserts the login redirect (307) only; the always-true "other email" check was removed. *Done.*
- The repeated "not deleted" message is one constant; the contact email is shared from `lib/account.ts`. *Done.*
- UploadBox's leftover clean-up now skips everything if any listing fails (before: only that folder). *Kept:* rare, and the next upload tries again.
- Consent as the basis for reading documents is debatable. *Recorded* for the legal review in `docs/todo.md`.

## Checks after the fixes
`npx tsc --noEmit`, lint, `npm test` 175/175, `e2e/account.spec.ts` + `e2e/learning.spec.ts` 15/15. Before the fixes: the full `npm run test:e2e` 122/122, `npm run test:db` passed, `npm run test:smoke` 1/1 with zero data retention on.
