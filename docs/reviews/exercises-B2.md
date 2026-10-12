# Exercise review: B2 (2026-10-12)

Run with `/improve-exercises B2`: two opus editor agents checked every item, and an opus verifier that didn't edit accepted or reverted each change.

- Sets checked: 10 (300 items). Items changed: 13. Rejected by the verifier: 1 (relc-05, replaced with the verifier's correction).
- No item id, slug or item count changed.

## Changes by reason

**Wrong or unnatural German**
- konjunktiv-ii-past kj2p-05: the condition made no sense ("wenn ich es gekannt hätte": already knew the book) → "wenn ich davon gewusst hätte".
- infinitive-clauses-ohne-statt ohne-26: "ihre Ideen zeigen" → "ihre Ideen vorstellen".

**Missing accepted answer or word order**
- two-part-conjunctions tpc-30: added "Tom hat weder Geld noch Zeit für den Urlaub."
- infinitive-clauses-ohne-statt ohne-29: added "statt dass ihr Tom half".
- nominalisation nom-27: added the genitive "Frühstückes".

**Explanation**
- modal-particles mp-17: etwa means the speaker hopes the answer is no but fears it is yes.

**Duplicates** (same or near-same sentence as another item, or showing another item's answer), rewritten under the same id, testing the same point
- two-part-conjunctions tpc-02 (= tpc-30), tpc-20 (≈ tpc-23)
- relative-clauses-advanced relc-05: first rewrite still mirrored relc-26, so the verifier's version was used: "Ich habe nichts gefunden, ___ mir gefällt."; relc-07 (≈ relc-27)
- modal-particles mp-03, mp-09, mp-22

## Flagged for the owner (optional, not changed)

- pass-alt-25 also accepts "Wie lässt dieser Fleck sich entfernen?" (grammatical, less usual).
- kj2p-30 doesn't accept the colloquial "dass er hätte mehr lernen sollen"; kj1-02 accepts only Konjunktiv I "habe", though "hätte" is common in speech.
- nom-28: "Beendung" may be a rare variant of "Beendigung"; not added.
- relc-21: the hint offers "das" after "das Beste"; "was" is the standard form.
- mp-06, mp-01: the wrong options are possible regionally; the tone cue picks the intended answer.
- Same point tested more than once (no giveaway): pasv-10/14/19, kj2p-11/22/24, mp-01/02, ohne-03/06/07.
- pass-alt-18 (erhältlich) tests -lich rather than -bar.
- part-22 also accepts "flüchtenden" (from flüchten, not the hinted fliehen). Harmless.

## Answer data

Not enough yet; both queries (as in `exercises-A1.md`, over the 10 B2 slugs) returned no rows.

## Checks

- `npm run sync:exercises`: synced 81 sets (no generated-file changes)
- `npm test`: 158/158 pass
- `npm run lint`: clean
- `bash e2e/all-practice-pages.sh` (local dev server): RESULT: PASS (81 pages)
- `git diff` shows no changed `"id"` lines
- PR, `ai-code-reviewer` and `/security-scan-changed`: not run yet. The owner asked to keep changes local until after the 2026-10-13 code review.
