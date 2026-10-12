# Smoother answering, keyboard choice and handwritten uploads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct answers move on by themselves after 1.5 s, wrong answers wait for one click anywhere or Enter; ← / → choose between answer boxes in all exercises; Customized Learning reads handwritten notes and refuses photos with no readable text.

**Architecture:** Two small pure modules decide "does this click/key mean continue?" and "which box gets focus next?" (unit-tested); two client hooks wrap them (`useAdvance`, `useArrowKeys`) and are used by the flashcard game and the shared exercise screen. Handwriting is a prompt change in the one OpenRouter call plus a refusal path in the upload action.

**Tech Stack:** Next.js App Router, React (client components), TypeScript, Tailwind 4, Node's built-in test runner (`.test.mjs` importing `.ts`), playwright-cli browser checks. No new packages.

**Spec:** `docs/superpowers/specs/2026-10-12-smoother-answers-handwriting-design.md`

## Global Constraints

- No new npm packages. Model stays `google/gemini-2.5-flash-lite` (`ANALYSIS_MODEL`); the OpenRouter call stays only in `lib/learning/analyse.ts` (server-only); the strict JSON schema and the `file-parser` native engine are unchanged.
- Correct answer: moves on after exactly `ADVANCE_DELAY_MS = 1500`. Wrong answer: waits for a click anywhere (not on links, buttons, fields) or Enter. A click or Enter during the 1.5 s skips the wait. Never advance twice.
- The result stays announced through the existing `role="status"` elements.
- ← / → move focus within one group of answer boxes, wrapping at the ends, skipping disabled boxes. Enter/Space keep their native button behaviour. No number keys. Typed answers unchanged.
- Remove the exercises' "Continue →" button and the flashcards' "Tap or press Enter to continue →" button; show the plain hint "Click anywhere or press Enter to continue" only under a wrong answer.
- Photo uploads whose `extractedText` is empty are not saved; message: "We couldn't read any text in this photo. Try a sharper photo in good light, or write a little larger."; the upload is given back.
- New upload note: "Textbook pages, worksheets, notes (typed or neatly handwritten) or homework. Don't upload documents with personal details."
- The handwriting test photos in `~/Desktop/de-app-screenshots/handwriting/` are never committed.
- Branch `feature/smoother-answers-handwriting`; one PR; `ai-code-reviewer` report in `docs/reviews/`, `/security-scan-changed`, suggested usability tests. No merge or push without the owner.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **The click that gives the answer must not also advance** (the global listener is attached right after the answer renders). Pinned in Task 1 (listener attached on the next tick) and checked in the browser in Tasks 2–3.
- **Clicks on Restart, the level picker, nav links, "Back to …" links and text fields** must keep working and never count as continue. Pinned in Task 1's tests and Task 2's browser check.
- **A manual skip during the 1.5 s, then the timer firing,** must not skip a second question. Pinned in Task 1 (timer cleared on change) and the browser checks (question number goes up by exactly one).
- **Enter in the typed-answer field** submits first (as now); the next Enter continues — not both at once. Pinned in Task 3's browser check.
- **A blank photo** is refused with the new message and no saved document; a readable document with no grammar still saves as "No German grammar topics found". Pinned in Task 4 (unit) and Task 5 (browser, real AI).

---

### Task 1: Pure decision logic and the two hooks

**Files:**
- Create: `lib/answer-keys.ts`, `lib/answer-keys.test.mjs`, `lib/useAdvance.ts`, `lib/useArrowKeys.ts`

**Interfaces:**
- Produces: `ADVANCE_DELAY_MS = 1500`; `clickContinues(target: { closest(selector: string): unknown } | null): boolean`; `keyContinues(e: { key: string; repeat: boolean }, focused: { tagName: string; readOnly?: boolean; isContentEditable?: boolean } | null): boolean`; `nextEnabled(current: number, enabled: boolean[], step: 1 | -1): number` (answer-keys.ts, no imports). `useAdvance(answered: boolean, correct: boolean, next: () => void): void`; `useArrowKeys<T extends HTMLElement>(): React.RefObject<T | null>` — returns a ref to put on the group element.

- [ ] **Step 1: Failing tests (`lib/answer-keys.test.mjs`)**

```js
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ADVANCE_DELAY_MS, clickContinues, keyContinues, nextEnabled } from "./answer-keys.ts";

const el = (interactive) => ({ closest: (sel) => (interactive && sel.includes(interactive) ? {} : null) });

test("a click continues unless it lands on a link, button or field", () => {
  assert.equal(clickContinues(el(null)), true); // empty space, text, the card
  for (const tag of ["a", "button", "input", "textarea", "select", "label", "[role=button]"]) assert.equal(clickContinues(el(tag)), false, tag);
  assert.equal(clickContinues(null), true);
  assert.equal(ADVANCE_DELAY_MS, 1500);
});

test("Enter continues unless a button, link or editable field is focused; repeats never do", () => {
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "BODY" }), true);
  assert.equal(keyContinues({ key: "Enter", repeat: false }, null), true);
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "INPUT", readOnly: true }), true); // answered typed item
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "INPUT", readOnly: false }), false);
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "BUTTON" }), false); // the button handles Enter itself
  assert.equal(keyContinues({ key: "Enter", repeat: false }, { tagName: "A" }), false);
  assert.equal(keyContinues({ key: "Enter", repeat: true }, { tagName: "BODY" }), false);
  assert.equal(keyContinues({ key: " ", repeat: false }, { tagName: "BODY" }), false);
});

test("arrow focus moves to the next enabled box and wraps", () => {
  assert.equal(nextEnabled(0, [true, true, true], 1), 1);
  assert.equal(nextEnabled(2, [true, true, true], 1), 0); // wraps right
  assert.equal(nextEnabled(0, [true, true, true], -1), 2); // wraps left
  assert.equal(nextEnabled(0, [true, false, true], 1), 2); // skips disabled
  assert.equal(nextEnabled(1, [false, true, false], 1), 1); // nothing else enabled
  assert.equal(nextEnabled(-1, [true, true], 1), 0); // nothing focused yet
});
```
Run `npm test` → FAIL (no `answer-keys.ts`).

- [ ] **Step 2: `lib/answer-keys.ts`**

```ts
// What counts as "continue" after an answer, and where arrow keys move focus. No imports, so Node tests load it.

export const ADVANCE_DELAY_MS = 1500; // a correct answer stays this long, then the next question appears

// Clicks on these keep doing their own thing (Restart, the level picker, links, text fields).
const OWN_ACTION = "a, button, input, textarea, select, label, [role=button]";

export function clickContinues(target: { closest(selector: string): unknown } | null): boolean {
  return !target?.closest(OWN_ACTION);
}

/** Enter continues, except on a focused button or link (they act on Enter themselves) or an editable field. */
export function keyContinues(
  e: { key: string; repeat: boolean },
  focused: { tagName: string; readOnly?: boolean; isContentEditable?: boolean } | null,
): boolean {
  if (e.key !== "Enter" || e.repeat) return false;
  if (!focused) return true;
  const tag = focused.tagName;
  if (tag === "BUTTON" || tag === "A" || tag === "SELECT") return false;
  if ((tag === "INPUT" || tag === "TEXTAREA") && !focused.readOnly) return false;
  return !focused.isContentEditable;
}

/** The next enabled index after `current` in direction `step`, wrapping; `current` if none other is enabled. */
export function nextEnabled(current: number, enabled: boolean[], step: 1 | -1): number {
  const n = enabled.length;
  for (let k = 1; k <= n; k++) {
    const i = (((current + step * k) % n) + n) % n;
    if (enabled[i] && i !== current) return i;
  }
  return current;
}
```
Run `npm test` → pass.

- [ ] **Step 3: `lib/useAdvance.ts`**

```ts
"use client";
import { useEffect, useRef } from "react";
import { ADVANCE_DELAY_MS, clickContinues, keyContinues } from "./answer-keys";

/** After an answer: a correct one moves on by itself after ADVANCE_DELAY_MS; any answer moves on with a click
 * anywhere (outside links, buttons and fields) or Enter. Listeners start on the next tick, so the click or key
 * press that gave the answer never counts; everything is cleared when the question changes, so it never advances twice. */
export function useAdvance(answered: boolean, correct: boolean, next: () => void): void {
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; });
  useEffect(() => {
    if (!answered) return;
    let done = false;
    const go = () => { if (!done) { done = true; nextRef.current(); } };
    const onClick = (e: MouseEvent) => { if (clickContinues(e.target as Element | null)) go(); };
    const onKey = (e: KeyboardEvent) => {
      if (keyContinues(e, document.activeElement as HTMLInputElement | null)) { e.preventDefault(); go(); }
    };
    const start = setTimeout(() => {
      document.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
    }, 0);
    const auto = correct ? setTimeout(go, ADVANCE_DELAY_MS) : undefined;
    return () => {
      done = true;
      clearTimeout(start);
      clearTimeout(auto);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [answered, correct]);
}
```
Note: `document.activeElement` is `<body>` when nothing is focused; `keyContinues` treats BODY as continue.

- [ ] **Step 4: `lib/useArrowKeys.ts`**

```ts
"use client";
import { useEffect, useRef } from "react";
import { nextEnabled } from "./answer-keys";

/** Put the returned ref on a group of answer buttons: ← / → move focus between its enabled buttons, wrapping. */
export function useArrowKeys<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
      if (!buttons.length) return;
      const i = nextEnabled(buttons.indexOf(document.activeElement as HTMLButtonElement), buttons.map((b) => !b.disabled), e.key === "ArrowRight" ? 1 : -1);
      if (i >= 0 && buttons[i]) { e.preventDefault(); buttons[i].focus(); }
    };
    group.addEventListener("keydown", onKey);
    return () => group.removeEventListener("keydown", onKey);
  });
  return ref;
}
```

- [ ] **Step 5: Check and commit**

`npm test && npx tsc --noEmit && npm run lint` → clean.
```bash
git add lib/answer-keys.ts lib/answer-keys.test.mjs lib/useAdvance.ts lib/useArrowKeys.ts
git commit -m "Add the continue and arrow-key logic for answering"
```

### Task 2: Flashcards (der · die · das)

**Files:**
- Modify: `components/ArticlesGame.tsx` (the `Game` component ~lines 292–434; the how-to-use list ~line 116)
- Modify: `e2e/articles.sh`

**Interfaces:**
- Consumes: `useAdvance`, `useArrowKeys` (Task 1).

- [ ] **Step 1: Wire the hooks into `Game`**

At the top of `Game` (after `const card = …` and the `if (!card) return null;` guard is NOT allowed before hooks — put the hooks before that guard, computing `correct` safely):
```tsx
  const answersRef = useArrowKeys<HTMLDivElement>();
  const correctNow = !!card && chosen === card.article;
  useAdvance(chosen !== null, correctNow, onAdvance);
```
(Hooks must run before any early return; move `const { cards } = useFlashcards(); const card = …` above them as today and keep `if (!card) return null;` after the hooks.)

Put `ref={answersRef}` on the answers grid `<div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">`.

- [ ] **Step 2: Remove the click-to-advance on the card and the continue button**

- Remove the card `div`'s `onClick` that calls `onAdvance` (the global click listener replaces it) and the `cursor-pointer` class logic (keep `cursor-pointer` only when `chosen` and the answer was wrong — clicking anywhere continues — so: `${chosen && !isCorrect ? "cursor-pointer" : ""}`).
- Delete the "Tap or press Enter to continue →" `<button>` and its comment.
- Under the Rule/Exception blocks, when the answer is wrong, add:
```tsx
            {!isCorrect && <p className="self-center text-xs text-zinc-400 dark:text-zinc-500">Click anywhere or press Enter to continue</p>}
```
- Keep the Restart button's `event.stopPropagation()` (harmless) — Restart is a button, so `clickContinues` already ignores it.

- [ ] **Step 3: How-to-use text** (~line 116): replace "Tap the card or press Enter to go to the next word." with "A correct answer moves on by itself; after a mistake, click anywhere or press Enter. Use ← and → to choose, Enter to pick."

- [ ] **Step 4: Update `e2e/articles.sh`**

The C-band loop currently answers with Enter and advances with a second Enter. Replace its advance step so it works for both outcomes: after the first Enter (answers the focused first button), wait 2 s (a correct answer advances by itself after 1.5 s); if the noun hasn't changed, press Enter once more. Keep the "card $i is a new card" check (noun differs from the previous one). Add a new section before "Old saved choice":
```bash
echo "== Arrow keys choose, Enter picks"
pw goto "$BASE/articles" >/dev/null; sleep 3
focused() { js "() => document.activeElement?.textContent.trim()"; }
check "first answer focused" '[ "$(focused)" = "\"der\"" ]'
pw press ArrowRight >/dev/null; sleep 0.3
check "→ moves to die" '[ "$(focused)" = "\"die\"" ]'
pw press ArrowLeft >/dev/null; pw press ArrowLeft >/dev/null; sleep 0.3
check "← wraps to das" '[ "$(focused)" = "\"das\"" ]'
before=$(noun); pw press Enter >/dev/null; sleep 0.5
check "Enter picks it (feedback shown)" '[ "$(js "() => /Correct!|Not quite\\./.test(document.body.innerText)")" = "true" ]'
sleep 2; [ "$(noun)" = "$before" ] && pw press Enter >/dev/null && sleep 1
check "the next card appears without a continue button" '[ "$(noun)" != "$before" ] && [ "$(js "() => [...document.querySelectorAll(\"button\")].some(b=>/continue/i.test(b.textContent))")" = "false" ]'
echo "== A wrong answer waits; a click on empty space continues"
```
For the wrong-answer check, use this approach: on a fresh card, click "der"; if feedback says "Correct!", wait 2 s and repeat on the next card (at most 6 tries) until a "Not quite." appears; then wait 2.5 s and check the noun is unchanged (it waited), click the page background (`js "() => { document.body.click(); return 1 }"` dispatches a click on body, which is not a link/button), sleep 0.5, check the noun changed. Then check a click on "Restart" restarts (card counter shows "Card 1 of 30") rather than counting as continue — only when a card is answered wrong, so do it right after the next wrong answer. Count the checks in the README section afterwards.

- [ ] **Step 5: Run and commit**

`npx tsc --noEmit && npm run lint && npm test && npm run build`; with `npm run dev` running: `bash e2e/articles.sh` → `RESULT: PASS`.
```bash
git add components/ArticlesGame.tsx e2e/articles.sh
git commit -m "Flashcards: correct answers move on by themselves; arrow keys choose"
```

### Task 3: Exercises (topic practice, Practise my focus, mistakes rounds)

**Files:**
- Modify: `components/exercises/ExerciseSession.tsx`
- Modify: `e2e/exercises.sh`

**Interfaces:**
- Consumes: `useAdvance`, `useArrowKeys` (Task 1).

- [ ] **Step 1: Advance**

In `ExerciseSession`, hooks must run before the early returns (`if (!mounted) …`, the round-end branch). Add right after the existing `useState` calls:
```tsx
  const atEnd = index >= round.length;
  useAdvance(!atEnd && answered !== null, !!answered?.correct, () => { setAnswered(null); setIndex((i) => i + 1); });
```
Delete the "Continue →" `<button>`. Under the explanation, when wrong, add:
```tsx
            {!answered.correct && <p className="text-xs text-zinc-400 dark:text-zinc-500">Click anywhere or press Enter to continue</p>}
```

- [ ] **Step 2: Arrow keys**

- `ChoiceView`: `const groupRef = useArrowKeys<HTMLDivElement>();` and `ref={groupRef}` on the `role="group" aria-label="Choose the answer"` div.
- `OrderView`: the word pool already has `ref={pool}`; replace it with a merged approach: `const poolKeys = useArrowKeys<HTMLDivElement>();` and keep the existing `pool` ref by assigning both: `ref={(el) => { pool.current = el; poolKeys.current = el; }}`. Add `const placedKeys = useArrowKeys<HTMLDivElement>();` on the "Your sentence" group div (its buttons remove a placed word).
- `TypeView`: unchanged.

- [ ] **Step 3: Update `e2e/exercises.sh`**

- `cont()` becomes: `cont() { js "() => { document.body.click(); return 1 }" >/dev/null; sleep 0.5; }` (a click on empty space). Where a question was answered **right**, the next question appears by itself after 1.5 s; calls of `cont` after a right answer must instead `sleep 2` (or keep calling `cont`, which is then a no-op only if the question already moved on — it isn't: a click after the auto-advance would skip the next question). So update `play` and the other call sites: after a **wrong** answer call `cont`; after a **right** answer `sleep 2`. Line 128 (`answer_now simple-past right; cont`) → `answer_now simple-past right; sleep 2`.
- Section 6 (Enter): after "Enter submits the typed answer ('Correct!' feedback)", the old second Enter would now skip a question (the right answer moves on by itself). Change it to: wait 2 s and check the question number went up by exactly one (or the round ended). Add a wrong typed answer case: type a wrong word, Enter → "Not quite." shown; wait 2.5 s → same question; Enter → next question.
- Add a section: on a choice item, the first option is focused; → moves focus to the second option; Enter picks it (feedback shown). On an order item, → moves between the word tiles.
- Add: no button with text "Continue" exists after answering.

- [ ] **Step 4: Run and commit**

`npx tsc --noEmit && npm run lint && npm test && npm run build`; `bash e2e/exercises.sh` → `RESULT: PASS` (needs the test accounts; `e2e/lib.sh` loads the git-ignored `.env.e2e` automatically — never print it). Also `bash e2e/all-practice-pages.sh` → PASS.
```bash
git add components/exercises/ExerciseSession.tsx e2e/exercises.sh
git commit -m "Exercises: no Continue button, correct answers move on, arrow keys choose"
```

### Task 4: Handwriting: prompt, unreadable photos, upload note

**Files:**
- Modify: `lib/learning/analyse.ts` (`PROMPT`)
- Modify: `lib/learning/uploads.ts` (`UPLOAD_NOTE`, new `photoUnreadable`)
- Test: `lib/learning/uploads.test.mjs`
- Modify: `app/learning/actions.ts`

**Interfaces:**
- Produces: `photoUnreadable(kind: UploadKind, extractedText: string): boolean` (uploads.ts) — true only for `kind === "images"` and an empty or whitespace-only text.

- [ ] **Step 1: Failing test** — add to `lib/learning/uploads.test.mjs` (import `photoUnreadable`, `UPLOAD_NOTE`):
```js
test("a photo with no readable text is refused; other kinds and readable photos are not", () => {
  assert.equal(photoUnreadable("images", ""), true);
  assert.equal(photoUnreadable("images", "  \n "), true);
  assert.equal(photoUnreadable("images", "Ich bin der Meinung, dass"), false);
  assert.equal(photoUnreadable("pdf", ""), false);
  assert.equal(photoUnreadable("docx", ""), false);
  assert.match(UPLOAD_NOTE, /neatly handwritten/);
});
```
Run → FAIL.

- [ ] **Step 2: `uploads.ts`**

Replace `UPLOAD_NOTE` with the exact text from Global Constraints, and add:
```ts
/** A photo upload the model read no text from at all (blank, blurred, unreadable handwriting) isn't saved. */
export function photoUnreadable(kind: UploadKind, extractedText: string): boolean {
  return kind === "images" && extractedText.trim() === "";
}
```
Run → pass.

- [ ] **Step 3: `actions.ts`**

Add to `ERRORS`: `unreadablePhoto: "We couldn't read any text in this photo. Try a sharper photo in good light, or write a little larger.",`. Import `photoUnreadable`. Right after `const a = result.analysis;`:
```ts
    if (photoUnreadable(kind, a.extractedText)) {
      await giveBackUpload(usageId, userId);
      return { error: ERRORS.unreadablePhoto };
    }
```
Update `giveBackUpload`'s doc comment to mention "or read no text from a photo".

- [ ] **Step 4: Prompt (`analyse.ts`)**

Replace the first line and item 1 and the mistakes sentence so `PROMPT` reads:
```
You help a learner of German. Read the attached document (a textbook page, worksheet, notes or homework). It may be printed, typed or handwritten, and a photo may be sideways or upside down: read it in the right orientation.
1. extractedText: transcribe the document's text (max 8000 characters). Leave out crossed-out words. Write [?] for a word you can't read. If there is no readable text, use "" and never invent text.
2. noGrammar: true if there is no readable text or the document contains no German grammar.
3. topics: 3 to 6 grammar topics the learner should practise, chosen ONLY from this list (use the slug exactly):
${CATALOGUE}
Base topics ONLY on what is in the document. Words in another colour, underlined or boxed are emphasis (what the learner marked as important): rank those topics higher, but they are NOT mistakes. Only clear correction marks (a word crossed out and rewritten, a tick or cross, a correction in the margin) are mistakes: put those topics first and set fromMistake to true. For each topic give a one-line reason that quotes the document.
4. title: a short title for the document, for example "Textbook p. 34: dative prepositions".
```

- [ ] **Step 5: Check and commit**

`npm test && npx tsc --noEmit && npm run lint && npm run build`.
```bash
git add lib/learning/analyse.ts lib/learning/uploads.ts lib/learning/uploads.test.mjs app/learning/actions.ts
git commit -m "Read handwritten notes; refuse photos with no readable text"
```

### Task 5: Handwriting checks with real AI calls

**Files:**
- Modify: `e2e/learning.sh` (blank-photo check)
- Modify: `docs/testing.md`

- [ ] **Step 1: Re-run the handwriting test** on the 8 owner photos with the new prompt (a throwaway script outside the repo, e.g. `.git/spike/run.mjs`, importing `lib/learning/suggestions.ts` and `lib/grammar/topics.ts` and reading `PROMPT` from `analyse.ts`; run with `node --env-file=.env.local`; never print the key). Compare with the first run (spec, "Handwriting test"): transcription of the sideways table page, crossed-out words left out, `[?]` used instead of guesses, sensible topics, no `fromMistake: true` from coloured emphasis. Cost about $0.01.
- [ ] **Step 2: Update `e2e/learning.sh` check 4**: uploading `blank.png` now shows "We couldn't read any text in this photo" and creates no document (count unchanged), and the upload counter is unchanged (given back).
- [ ] **Step 3: Run** `bash e2e/learning.sh` against the dev server (4 real AI calls, uses the `e2e-main` test account; accounts load from the git-ignored `.env.e2e`) → `RESULT: PASS`.
- [ ] **Step 4:** Add the results to `docs/testing.md` (handwriting test table summary without the photos; e2e results). Commit `e2e/learning.sh docs/testing.md`: "Check unreadable photos in the upload test; record the handwriting results".

### Task 6: Docs

**Files:** `CLAUDE.md`, `README.md`, `e2e/README.md`

- [ ] CLAUDE.md, "Flashcard Game Interaction Requirements": replace the "Click anywhere on a flipped card to advance…" bullet with: correct answers move on by themselves after 1.5 s; after a mistake, a click anywhere (not on links, buttons or fields) or Enter continues; a hint shows only after a mistake; ← / → move between der · die · das and Enter picks; the result is announced via `role="status"`; the first answer button is focused on each new card. Keep every other bullet. In "AI rules": add that handwriting is expected (crossed-out words left out, `[?]` for unreadable words, colour/underline = emphasis, only correction marks = mistakes) and that a photo with no readable text is not saved and the upload is given back.
- [ ] README: replace "Handwriting isn't supported; uploads should be printed or typed material." with the new behaviour; mention answering flow and arrow keys in the feature list where the practice pages are described.
- [ ] e2e/README.md: update the descriptions of `articles.sh` and `exercises.sh` checks (no Continue; arrow keys) and `learning.sh` check 4.
- [ ] Commit: "Document smoother answering, arrow keys and handwritten uploads".

### Task 7: Review, scan, PR

- [ ] `ai-code-reviewer` on `main...feature/smoother-answers-handwriting`; save the report as `docs/reviews/pr-<n>-smoother-answers-handwriting.md`; fix confirmed findings (tests first).
- [ ] `/security-scan-changed`; fix confirmed findings.
- [ ] Suggest usability tests to the owner: a full flashcard round and a topic practice round by keyboard only; a round by mouse only with a few deliberate mistakes; a phone round by touch (tap anywhere after a mistake); upload a handwritten page and a blank photo.
- [ ] With the owner's OK: push, open the PR.
