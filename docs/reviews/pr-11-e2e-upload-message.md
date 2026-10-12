# ai-code-reviewer report: PR #11

- **Pull request:** "Fix the e2e upload-message selector and record the live run" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `fix/e2e-upload-message` → `main`, reviewed at commit `8665d8c`
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on `git diff main...fix/e2e-upload-message` before merging. It did not run the e2e scripts (they make real AI calls).
- **Scope:** one selector in `e2e/learning.sh` (`wait_upload`), one comment, and the `learning.sh` row in `docs/testing.md`.

## Verdict
Ready to merge. The selector fix is correct and minimal. One wording point in `docs/testing.md` needed fixing first.

## Findings

### Critical
None.

### Warning
1. **The testing.md row claimed more than was observed.** It said check 9 "was re-run alone on the live site and passed (both rejection messages shown, no quota used)". Check 9 has four assertions (two messages, quota unchanged, storage empty); the re-run only read the two messages.
2. **Side effect worth recording.** In the 27/29 run every real upload also hit the empty allowance note, waited the full 90 s and printed "(no result after 90s)". Those checks still passed because they read the new document and the storage folder, so the 27 passes stand.

### Suggestion
- An id on the upload result paragraph (for example `id="upload-status"` in `UploadBox.tsx`) and `querySelector('#upload-status')` would be sturdier than excluding `#allowance-note`, which breaks again if a third live region is added to the card. Not worth an app change now; do it next time `UploadBox.tsx` is touched.

### Checks that passed
1. The new selector picks the right element in every state: idle (no match, keeps polling), busy (busy text, keeps polling), error (`role=alert`) and done (`role=status`) (only the result paragraph matches), and 0 uploads left (the filled note is excluded). `choose` reloads `/learning` each time, so no stale message carries over, and `#upload-title` is still a direct child of the section.
2. No other e2e script relies on `[role=status]` / `[role=alert]` in the upload card; the app's other `role=status` elements are outside it.
3. The diff stays in scope: no dead code, no duplication.
4. The rest of the row matches the evidence: 27/29 live, the 2 failures in check 9 from a test bug introduced in PR #7, and the new check 1 passing.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Fixed: the row now says the two message checks were re-run and read correctly, and that check 9's quota and storage checks passed in the full run (the card showed the same uploads left afterwards). |
| Warning 2 | Fixed: the row records the 90 s waits and why the upload checks still stand. |
| Suggestion | Deferred to the next change to `UploadBox.tsx`. |
