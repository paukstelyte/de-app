# Exercise review: B1 (2026-10-12)

Run with `/improve-exercises B1`: four opus editor agents checked every item, and an opus verifier that didn't edit accepted or reverted each change.

- Sets checked: 17 (510 items). Items changed: 23. Reverted by the verifier: 0.
- No item id, slug or item count changed.

## Changes by reason

**Wrong German**
- past-perfect pp-24: "putzte ich die Zähne" → "putzte ich mir die Zähne".

**A second correct answer**
- verbs-with-prepositions vwp-10: the distractor "am" was also right ("am Geburtstag") → replaced by "fürs".

**Missing accepted answer or word order**
- indirect-questions indq-06: the tiles also make "Anna weiß nicht, wo Tom wohnt." → added.
- concessive-obwohl-trotzdem obw-21: added "Der Kaffee ist kalt, trotzdem trinkt ihn Anna gern."

**Explanation**
- simple-past past-17: said nehmen → nahm changes the consonant too; only the vowel changes.
- past-perfect pp-27: said rief was in position one; the nachdem-clause is.

**Duplicates** (same or near-same sentence as another item, or showing another item's answer), rewritten under the same id, testing the same point
- genitive-case gen-13 (gen-04 showed "Hauses")
- prepositions-genitive pgen-01, pgen-24
- past-perfect pp-23 (≈ pp-02)
- future-tense fut-11, fut-19
- passive-present-past pas-19, pas-24
- relative-clauses rel-28, rel-29
- infinitive-with-zu inf-zu-25, inf-zu-27, inf-zu-30
- als-wenn alw-30 (≈ alw-02)
- konjunktiv-ii-hypothetical konj2-29 (gave away konj2-06)
- verbs-with-prepositions vwp-16 (≈ vwp-01)
- consequence-deshalb deshalb-12 (gave away deshalb-03)

## Flagged for the owner (optional, not changed)

- In future-tense (fut-19–22) the typed answer is just the infinitive given in the hint; in pas-/pp- items the hint names the verb and the learner forms the participle. A design choice.
- Topic-summary example sentences reappear as items: umz-22, umz-02, konj2-01, alw-25/26. Only matters if the summary is shown next to the exercises.
- alw-13 tests wann (indirect question), not als vs wenn; alw-02/09/22/24 use conditional wenn in a topic titled "time clauses".
- indq-16 tests verb agreement rather than indirect-question word order.
- pgen-16: "statt der Arbeit" is grammatical but unnatural; another distractor would remove all doubt.
- adjd-23: the hint "(best)" isn't a dictionary form; "(gut, superlative)" is clearer.
- Repeated frames, no giveaway: pp-15/29 (Schlüssel verloren), pas-06/07/19, rel-09/10, obw-14/22, deshalb-19/30, inf-zu-06/30, alw-14/29; warten auf in five vwp items; past-30's tiles include "kam" (past-10's answer).
- Colloquial forms not accepted: "über was" (vwp-25), "drauf" (vwp-26). Textbook forms preferred in pp-04, adjd-29, umz-18, konj2-20.

## Answer data

Not enough yet; both queries (as in `exercises-A1.md`, over the 17 B1 slugs) returned no rows.

## Checks

- `npm run sync:exercises`: synced 81 sets (no generated-file changes)
- `npm test`: 158/158 pass
- `npm run lint`: clean
- `bash e2e/all-practice-pages.sh` (local dev server): RESULT: PASS (81 pages)
- `git diff` shows no changed `"id"` lines
- PR, `ai-code-reviewer` and `/security-scan-changed`: not run yet. The owner asked to keep changes local until after the 2026-10-13 code review.
