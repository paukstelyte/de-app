# Smoother answering, keyboard choice and handwritten uploads — design

Date: 2026-10-12. Agreed with the owner in a grilling session (10 questions) and a handwriting test on 8 of the owner's own note pages. One branch, one PR.

## Goal

1. Answering flows without a Continue click: a correct answer moves on by itself; a wrong answer, or a correct answer on a flashcard with an exception note, waits for one click anywhere (or Enter).
2. Every set of answer boxes can be used with the arrow keys and Enter, as well as by clicking.
3. Customized Learning reads handwritten notes and teacher corrections, not only printed or typed pages.

## Decisions

| Area | Decision |
|---|---|
| Where | All four answering places: the der · die · das flashcards (normal rounds and "Learn from your mistakes"), topic practice, Practise my focus, and the exercises' "Practise my mistakes". |
| Correct answer | Shows "Correct!" (on flashcards also the rule and any exception) and moves on by itself after **1.5 seconds**. |
| Wrong answer | Stays, with the right answer and the explanation, until the player **clicks anywhere on the screen** or presses **Enter**. A click or Enter during a correct answer's 1.5 seconds skips the wait. |
| Clicks that don't advance | Clicks on links, other buttons (Restart, the level picker, the nav) and text fields keep doing their own thing; they don't count as "continue". |
| Continue buttons | The exercises' **Continue →** button and the flashcards' "Tap or press Enter to continue" button are removed. A short plain-text hint stays under an answer that waits (wrong, or correct on an exception card): "Tap or click anywhere, or press Enter to continue". |
| Screen readers | The result is still announced (`role="status"`) before the next question appears. |
| Arrow keys | **← / →** move between the der · die · das buttons, multiple-choice answers, the word tiles still to place in word-order questions, and the placed tiles (to remove one). Moving past the last box wraps to the first. **Enter** (and Space, as now) picks or places the focused box. Clicking still works. Typed answers are unchanged (type, then Enter). |
| Number keys | Not added. |
| Handwriting | Handwritten notes, and teacher corrections on printed or typed homework. The model stays **google/gemini-2.5-flash-lite** (owner's decision after the test). |
| Colour | Words written in another colour, underlined or boxed mean **emphasis** ("this is important"): those topics rank higher. Only clear **correction marks** (crossed out and rewritten, a tick or cross, a note in the margin) count as mistakes (`fromMistake: true`). The owner's samples had no teacher corrections, so that path is untested. |
| Unreadable photos | A photo upload where the model reads no text at all is **not saved**: the player sees "We couldn't read any text in this photo. Try a sharper photo in good light, or write a little larger." and the upload still counts (changed 2026-10-12 after the security scan: giving it back let blank photos bypass the spend limit). This also covers a blank photo, which today is saved as "No German grammar topics found". Documents with readable text but no German grammar behave as now. |
| Upload note | "Textbook pages, worksheets, notes (typed or neatly handwritten) or homework. Don't upload documents with personal details." |

## Handwriting test (2026-10-12)

8 pages of the owner's handwritten German notes, sent with the app's exact prompt and schema to the fixed model (about $0.0007–0.0011 each):

- A neat page in normal orientation (*Meinung äußern*): almost every line transcribed correctly; small slips ("fürde" for *finde*), and crossed-out words were included.
- A sideways photo of a sentence-structure table: the right main topic (subordinate clauses), but the layout fell apart and several words were misread.
- Five more pages (plurals, vocabulary, *Angst haben*, *Konjunktiv I/II*, Gerundiv): fitting titles and topics.
- One page failed once (an unusable answer) and worked on retry; the app already handles that with a "try again" message and gives the upload back.

Conclusion: the fixed model is good enough. The prompt is improved for handwriting (below) and the test is re-run on the same pages to compare.

## AI instructions (prompt) changes

In `lib/learning/analyse.ts`, the prompt says, in addition to today's rules:

- The document may be printed, typed or **handwritten**; photos may be **sideways or upside down**: read them in the right orientation.
- Leave out **crossed-out** words.
- Write **[?]** for a word that can't be read; never guess or invent text (today's "never invent text" rule stays).
- **Colour, underlining and boxes mean emphasis**: rank those topics higher. Only clear **correction marks** count as mistakes (`fromMistake: true`), first in the list.

The strict JSON schema, the topic catalogue rule, the `file-parser` native engine and the model constant are unchanged.

## Components

- `lib/useAdvance.ts` (new, client hook): given whether the current question is answered and whether the answer was correct, it moves on after 1.5 s for a correct answer, and on any click outside links, buttons and fields, or on Enter, once the question is answered. It cancels its timer and listeners when the question changes, so a manual skip never advances twice. It ignores the click or key press that gave the answer and held-down (repeating) keys.
- `lib/useArrowKeys.ts` (new, client hook): attached to a group of answer boxes; ← / → move focus between the group's enabled buttons, wrapping at the ends.
- `components/ArticlesGame.tsx`: uses both hooks; removes the continue button; adds the wrong-answer hint.
- `components/exercises/ExerciseSession.tsx`: uses both hooks (choice options, word tiles to place, placed tiles); removes Continue; adds the wrong-answer hint.
- `lib/learning/analyse.ts`: prompt changes above.
- `app/learning/actions.ts`: a photo upload whose `extractedText` is empty is refused with the new message; the upload is not given back, because the AI call was paid.
- `lib/learning/uploads.ts`: new upload note.
- Docs: CLAUDE.md (flashcard interaction rules, AI rules), README (handwriting), the how-to-use text on the flashcard page, `docs/testing.md`.

## Testing

- **Unit tests** for the pure parts of the two hooks: the decision "should this click/key advance?" (ignores links, buttons, fields, repeats) and "which box gets focus next?" (wraps at both ends, skips disabled boxes).
- **Browser checks** (playwright-cli, no AI): update `e2e/exercises.sh` (no Continue button: a wrong answer advances on a click on empty space and on Enter; a correct answer advances by itself) and `e2e/articles.sh` (same for flashcards; ← / → move focus between der · die · das and Enter picks); add arrow-key checks for a choice and a word-order item.
- **Handwriting:** re-run the 8-page test with the new prompt and compare (cost about $0.01); then `e2e/learning.sh` with real uploads, where the blank-photo check now expects the "couldn't read any text" message and no saved document.
- `npm test`, `tsc`, lint and build.

## Risks

- **Auto-advance can feel rushed** for correct answers with a long rule: the owner chose 1.5 s; a click is never needed for those, and the rule is shown again whenever the word is missed.
- **Global click handling** could swallow clicks meant for something else: links, buttons and fields are excluded and covered by tests.
- **Teacher corrections are untested** on real samples: the prompt rule is written carefully; ask the owner for a corrected homework photo later.
- **Blank-photo behaviour changes** (no longer saved): intended, and the e2e check is updated.

## Out of scope

- A different AI model.
- Number-key shortcuts.
- Changing how typed answers work.
- Up/down arrows or grid navigation.
