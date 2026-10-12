# Exercise review: C2 (2026-10-12)

Run with `/improve-exercises C2`: two opus editor agents checked every item, and an opus verifier that didn't edit accepted or reverted each change.

- Sets checked: 7 (210 items). Items changed: 6. Reverted by the verifier: 0.
- No item id, slug or item count changed.

## Changes by reason

**Broken sentence**
- word-order-emphasis woe-20: "die Zahlen" was in the prompt and in every option, so the filled sentence said it twice → removed from the prompt.

**Missing word order**
- modal-particle-combinations mpc-04: added "Schauen Sie sich doch mal in Ruhe die Unterlagen an."

**Explanation**
- hedging-formal-style hfs-07: mentioned an "es" that isn't in the sentence → the dass-clause is the singular subject, so ließe.

**Duplicates** (same or near-same sentence as another item, or showing another item's answer), rewritten under the same id, testing the same point
- konjunktiv-i-set-phrases kisp-21 (same formula as kisp-20, now "man beachte")
- hedging-formal-style hfs-02 (shared a frame with hfs-03)
- complex-sentence-structure csc-22 (≈ csc-21)

## Flagged for the owner (optional, not changed)

- hedging-formal-style: order items rebuild the core phrases the gap items test (hfs-24/01, 25/02, 26/04, 27/07, 29/06). Changing it means picking different phrases.
- hfs-13: the explanation reads as if dürfte were indicative.
- csc-19 doesn't accept the southern "zurücktreten hätte müssen"; csc-23 doesn't accept the borderline "Was hatte genau …".
- csc-22 / csc-24 word their hints differently for the same kind of gap.
- csc-17 lists "gelassen" as wrong; Duden calls "prüfen gelassen" rare but not wrong.
- svw-16/17 test regional sein/haben with sitzen/stehen, not the Perfekt-vs-Präteritum point in the summary.
- mpc-20's distractor "wohl doch" is grammatical but doesn't fit the tone; wfa-26 "erzwungen" is forced by the hint ("durchgesetzt" is more idiomatic).

## Answer data

Not enough yet; both queries (as in `exercises-A1.md`, over the 7 C2 slugs) returned no rows.

## Checks

- `npm run sync:exercises`: synced 81 sets (no generated-file changes)
- `npm test`: 158/158 pass
- `npm run lint`: clean
- `bash e2e/all-practice-pages.sh` (local dev server): RESULT: PASS (81 pages)
- `git diff` shows no changed `"id"` lines
- PR, `ai-code-reviewer` and `/security-scan-changed`: not run yet. The owner asked to keep changes local until after the 2026-10-13 code review.
