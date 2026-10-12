# Exercise review: A2 (2026-10-12)

Run with `/improve-exercises A2`: three opus editor agents checked every item, and an opus verifier that didn't edit accepted or reverted each change.

- Sets checked: 15 (450 items). Items changed: 32. Reverted by the verifier: 0.
- No item id, slug or item count changed.

## Changes by reason

**Wrong German**
- indefinite-pronouns ip-16: "sehr gut Pizza" → "sehr gute Pizza".

**Explanation**
- dative-case dat-14, prepositions-dative pdat-04: said Großeltern / Eltern add -n in the dative; they already end in -n.
- past-modal-verbs pm-21: gave the perfect as "habe … gekonnt"; with an infinitive it is "habe … anrufen können".

**Duplicates** (same or near-same sentence as another item, or showing another item's answer), rewritten under the same id, testing the same point
- dative-case dat-04 (= dat-01), dat-19 (≈ dat-02)
- pronouns-accusative-dative pron-28 (gave away pron-02)
- verbs-with-dative vdat-17 (≈ vdat-01), vdat-19 (≈ vdat-04)
- prepositions-accusative prep-acc-27 (gave away prep-acc-10)
- reflexive-verbs refl-17, refl-20, refl-30
- past-modal-verbs pm-01, pm-12, pm-13, pm-29
- comparative-superlative comp-04, comp-09, comp-19
- subordinate-clauses sub-05, sub-28
- konjunktiv-ii-polite kj-07 (clone of kj-04; options then differed from kj-06 on the verifier's advice), kj-09, kj-24
- indefinite-pronouns ip-15 (ip-02 showed "isst")
- ordinal-numbers-dates ord-07, ord-16, ord-18, ord-22, ord-23, ord-25 (several items asked for the same ordinal in the same frame)

## Flagged for the owner (optional, not changed)

- ip-22 "Möchtest du ___ trinken?": accept colloquial "was" for etwas?
- cn-25 Arbeitsplatz and cn-17 Arbeitszimmer both test Arbeit + -s-, and the topic summary shows Arbeitszimmer.
- Same form tested twice: kj-04/05 (hätten), kj-16/17 (könntet), ord-04/17 (vierte), comp-07/23 (gern → lieber), pm-11/17 (müssen + früh aufstehen).
- reflexive-verbs leans on sich freuen auf (refl-01, 06, 14, 25). pdat-07, 18, 23 all answer "zum" in the same frame.
- vdat-09 / vdat-27: the tile "Wem" shows vdat-09's answer.
- sub-27: the pronoun comes before the name it refers to; "Weil Lena viel arbeiten muss, hat sie …" is more neutral.
- prep-acc-19 accepts only "unseren" (unsren/unsern are rare). vdat-28 doesn't accept the marked "Gefällt das neue Kleid dir?".
- comp-25 "Im Supermarkt ist das Brot am teuersten": correct but an odd claim.
- dat-30 tests anrufen + accusative inside the dative set (a deliberate contrast).

## Answer data

Not enough yet; both queries (as in `exercises-A1.md`, over the 15 A2 slugs) returned no rows.

## Checks

- `npm run sync:exercises`: synced 81 sets (no generated-file changes)
- `npm test`: 158/158 pass
- `npm run lint`: clean
- `bash e2e/all-practice-pages.sh` (local dev server): RESULT: PASS (81 pages)
- `git diff` shows no changed `"id"` lines
- PR, `ai-code-reviewer` and `/security-scan-changed`: not run yet. The owner asked to keep changes local until after the 2026-10-13 code review.
