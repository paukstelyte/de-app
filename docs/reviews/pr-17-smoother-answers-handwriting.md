# ai-code-reviewer report: PR #17

- **Pull request:** "Smoother answering, arrow keys and handwritten uploads" (number assumed from the sequence; check when the PR is opened)
- **Branch:** `feature/smoother-answers-handwriting` → `main`, reviewed at commit `28c2957` (base `5168691`)
- **Date:** 2026-10-12
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`) on the most capable model, as the final whole-branch review before merging. It ran the unit tests, type check and lint; it did not run browser scripts or AI calls.
- **Scope:** spec `docs/superpowers/specs/2026-10-12-smoother-answers-handwriting-design.md`, plan Tasks 1–7: the continue and arrow-key logic (`lib/answer-keys.ts`, `lib/useAdvance.ts`, `lib/useArrowKeys.ts`); the flashcards and the shared exercise screen; the handwriting prompt, the unreadable-photo refusal and the upload note; the browser checks; docs.
- **Earlier reviews on this branch:** every task had its own spec and quality review (Task 5 needed one docs fix round). The fixed AI model was tested on 8 of the owner's handwritten pages before and after the prompt change.
- **Course-requirement checks requested:** one server-only OpenRouter call, model constant unchanged, native PDF engine, strict JSON schema, uploaded files deleted after every analysis; no new packages; no secrets.

## Verdict
Approve with fixes. Nothing critical. Two cheap must-fixes (hint contrast, stale test counts), and one hole in the AI-spend limit that needed an owner decision.

## Findings

### Critical
None.

### Warning
1. **The continue hint was too low in contrast** (`text-zinc-400` on the paper background, about 2.5:1; dark mode about 3.7:1), and it is now the only instruction after a mistake.
2. **`docs/testing.md` reported old results as current** (154 unit tests, 27/27 and 22/22 browser checks).
3. **Giving back the upload for an unreadable photo** deleted the usage row after a paid AI call, so blank photos could be sent in a loop without counting against the per-user or shared daily limits (also found by the security scan, Medium).
4. **A correct answer disappears after 1.5 s with no way to hold it**, so the rule is only briefly visible; close to the accessibility guideline on timed content. The owner chose 1.5 s.
5. **Screen-reader users weren't told how to continue after a mistake**: focus drops to the page and the hint isn't announced.

### Suggestion
1. The hint paragraph is written twice (flashcards and exercises).
2. `nextEnabled`'s nothing-focused branch can't happen in practice.
3. `useArrowKeys` re-subscribes on every render (deliberate; harmless).
4. Selecting rule text with the mouse after a mistake moves on.
5. The hint says "Click" on phones.

### Deferred-list triage
- **Must fix:** Warning 1, Warning 2.
- **Owner decision:** Warning 3.
- **Can wait:** a loose test mock, unchecked preconditions in the flashcard browser check, no browser check for arrows in "Your sentence", a photo read only as `[?]` (never happened in the real run). Task 1's follow-ups (wrap bug, doc comment, buttons not staying focused) were already closed.

### Checks that passed
1. `npm test` 158/158, `tsc` and lint clean; no package or lockfile change; no secrets.
2. AI rules: `lib/learning/analyse.ts` still server-only and the only OpenRouter caller; model, native PDF engine and strict schema unchanged; only the prompt changed; the unreadable-photo return is inside the `try`, so the files are still deleted.
3. Listeners: attached only while an answer is shown, one tick after the answer; cleared on reset, correctness change and unmount; the `done` flag prevents a double advance; nothing leaks to other pages.
4. Existing flows: Restart, level buttons, theme toggle and links are buttons or links, so they never count as continue; Restart cancels a pending auto-advance; round end and recap work; the round-end buttons still autofocus.
5. Keyboard: first answer focused on each question; ← / → wrap; Enter picks a focused button and continues on the page or a read-only field; held keys ignored; the typed-answer Enter doesn't also continue.
6. CLAUDE.md's flashcard rules match the code; the owner's new Working Rules line is present; the handwriting docs are honest ("asked, not guaranteed").

## Security scan of the changed files (2026-10-12)

`/security-scan-changed` scope, run as one combined scanner because the branch has no database, Supabase config or deployment changes (confirmed). **0 critical, 0 high, 1 medium, 0 low.**

| # | Finding | Severity | Action |
|---|---|---|---|
| 1 | Giving back the upload for an unreadable photo lets paid AI calls skip the daily limits (same as Warning 3). | Medium | Fixed by the owner's decision: the photo is still refused with the message, but the upload counts. |

**Checked and fine:** auth and owned-path checks still run first; the admin key stays server-only and pinned to the user; files are deleted in `finally` on the new path; only a fixed message reaches the browser; `photoUnreadable` uses the server's own upload kind; the prompt change keeps the key server-side; the new hooks are client-only and touch no data or network; no migrations, config or env changes; no secrets in this branch's commits.

**Not checked:** `.env` files (by rule); the SQL behind the upload quota (relied on `docs/supabase-schema.md`); behaviour on adversarial images.

## Owner decisions after the review (2026-10-12)

1. **Unreadable photos count as an upload** (no give-back), so the daily limits keep capping AI spend.
2. **Flashcards with an exception note wait for a click** after a correct answer, like a mistake; all other correct answers still move on after 1.5 s.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Fixed: the hint is `text-zinc-500 dark:text-zinc-400` in both places. |
| Warning 2 | Fixed: `docs/testing.md` records today's runs: `npm test` 158/158; `articles.sh` 33/33; `exercises.sh` 51/51; `all-practice-pages.sh` 81/81. `learning.sh` (check 4 now expects the upload to count) has not been re-run yet because the test account is near its daily limit; this is stated there. |
| Warning 3 / Security 1 | Fixed per owner decision 1; `giveBackUpload`'s comment corrected; `learning.sh` check 4 and its quota pre-check updated. |
| Warning 4 | Partly addressed per owner decision 2 (exception cards wait); otherwise 1.5 s stays, and it is on the usability-test list. |
| Warning 5 | Fixed: the status adds "Press Enter to continue." whenever the hint is shown. |
| Suggestion 4 | Fixed (test first): a click while text is selected doesn't continue. |
| Suggestion 5 | Fixed: "Tap or click anywhere, or press Enter to continue". |
| Suggestions 1–3 | No change: harmless. |

Re-run after the fixes: `npm test` 158/158, `tsc`, lint and build clean; `articles.sh` PASS (33), `exercises.sh` PASS (51), `all-practice-pages.sh` PASS (81). An exception card answered correctly stays with the hint and "Correct! Press Enter to continue."; a normal card moves on after 1.5 s.
