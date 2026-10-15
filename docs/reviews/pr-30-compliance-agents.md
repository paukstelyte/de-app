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
