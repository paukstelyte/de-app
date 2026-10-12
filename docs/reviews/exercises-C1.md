# Exercise review: C1 (2026-10-12)

Run with `/improve-exercises C1`: three opus editor agents checked every item, and an opus verifier that didn't edit accepted or reverted each change.

- Sets checked: 14 (420 items). Items changed: 11. Reverted by the verifier: 0.
- No item id, slug or item count changed.

## Changes by reason

**Wrong answer accepted**
- connectors-advanced ca-25: also accepted the swapped sentence (Koalition and Opposition reversed), which contradicts the English shown → removed, and the explanation no longer says they can swap. Found by the verifier.

**Unnatural German**
- verbs-with-genitive vwg-10: "Trotz zahlreicher Kritik" → "Trotz anhaltender Kritik".

**Missing word order**
- modal-verbs-subjective msv-14: added "Lena will nichts von dem Plan gewusst haben."

**Translation**
- conditionals-without-wenn cond-24: "we would have been home long ago" → "we would be home by now" (the result is present).

**Duplicates** (same or near-same sentence as another item, or showing another item's answer), rewritten under the same id, testing the same point
- passive-impersonal pimp-14 (≈ pimp-03)
- participle-clauses pc-01 (pc-08 showed "angekommen")
- nominal-verbal-style nvs-12 (nvs-04 showed "Unterzeichnung")
- funktionsverbgefuege fvg-14 (≈ fvg-05), fvg-26 (showed fvg-24's answer)
- verbs-with-genitive vwg-01 (≈ vwg-22)
- correlate-es-da kor-26 (gave away kor-18)

## Flagged for the owner (optional, not changed)

- funktionsverbgefuege: the order items rebuild phrases the choice items test (fvg-27/03, 29/02, 28/01, 30/04, 18/11; fvg-21's hint). Fixing it means redesigning the set.
- connectors-advanced: with only six connectors, order items ca-17/19/29 give away gap items ca-05/07/12/22.
- Single words shown in another item's tiles or prompt: pimp-29/19 (gestritten), pimp-06/26/22 (abgestimmt), fut2-03/09 (eingetroffen), sip-08/01, sip-12/11, sip-04/02.
- pfg-01 is close to the topic-summary example; pfg-30 tests gemäß + dative as a contrast.
- pimp-17 "kein Glauben" is fine; "kein Glaube" is more standard. msv-29: "muss" would be more natural than "dürfte" (not an option).
- ppe-08: "gestiegenen" is arguably acceptable next to "steigenden"; cond-26 doesn't accept the casual non-inverted clause.
- kor-17 and kor-27 test the same point.

## Answer data

Not enough yet; both queries (as in `exercises-A1.md`, over the 14 C1 slugs) returned no rows.

## Checks

- `npm run sync:exercises`: synced 81 sets (no generated-file changes)
- `npm test`: 158/158 pass
- `npm run lint`: clean
- `bash e2e/all-practice-pages.sh` (local dev server): RESULT: PASS (81 pages)
- `git diff` shows no changed `"id"` lines
- PR, `ai-code-reviewer` and `/security-scan-changed`: not run yet. The owner asked to keep changes local until after the 2026-10-13 code review.
