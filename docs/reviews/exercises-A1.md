# Exercise review: A1 (2026-10-12)

Run with `/improve-exercises A1`: four opus editor agents checked every item, and an opus verifier that didn't edit accepted or reverted each change.

- Sets checked: 18 (540 items). Items changed: 19. Reverted by the verifier: 0.
- No item id, slug or item count changed.

## Changes by reason

**Wrong German or wrong answer**
- negation-nicht-kein neg-03: "Wir trinken kein Kaffee" → answer `keinen` (Kaffee is masculine accusative), options keinen / kein / nicht. Found by the verifier.
- questions q-04, q-07, q-10, q-14, q-19, q-26: the prompt starts "Und ___ …", but options and answers were capitalised ("Und Wo wohnst du?") → lowercased.
- imperative imp-17: "Wascht bitte die Hände!" lacked the reflexive → "Kinder, ___ euch bitte die Hände!"

**A second correct answer**
- personal-pronouns pp-23: "sie" (die Sonne) was also right → "Das Wetter ist schön. Heute ist ___ sehr warm."
- sein-haben sh-03: "Anna ist eine Schwester" was also right → "Anna ___ zwei Schwestern."
- sein-haben sh-11: the option "haben" was also right → replaced by "bin".

**Off-topic or above the level**
- perfect-tense pf-29: a dass-clause (A2 word order) → "Am Sonntag sind wir ins Kino gegangen."

**Explanation**
- perfect-tense pf-17: "ge- + essen = gegessen" → explains the irregular participle (extra g, not geessen).

**Duplicates** (same or near-same sentence as another item, which gave away its answer)
- plural-nouns pl-29 (= pl-12), negation-nicht-kein neg-26 (≈ neg-05), imperative imp-23 (≈ imp-27), coordinating-conjunctions conj-26 (= conj-03), conj-28 (≈ conj-05), conj-29 (= conj-02): rewritten under the same id, testing the same point.

## Flagged for the owner (optional, not changed)

- **Typing special letters** (app-wide): the practice pages have no buttons for é, ä, ö, ü, ß, so a learner without them on their keyboard gets e.g. "Cafes" (pl-29) marked wrong. Options: accept ae/oe/ue/ss spellings, or add letter buttons under the input.
- conj-24 "Gehst du ins Kino ___ ins Theater? (oder / und)": "und" is grammatical too; accept it or change the hint.
- pp-28 das Mädchen → es: textbook answer; "sie" is common in speech.
- sh-09: the option "bist" gives "Du bist ein Auto" (nonsense, but a valid distractor); could swap for "habt".
- sh-27–30: test word order (incl. dass-clauses, borderline A1) as much as sein/haben.
- Near-duplicates kept as practice across item types: psh-01/psh-14, q-01/q-06, q-04/q-22, pf-05/pf-11/pf-28, time-01/time-26, time-08/time-27.
- word-order-verb-second wo-11, wo-16, wo-24, wo-27, wo-29: same "[Day] hat [Name] [Noun]" pattern, mostly without "am".
- Marked but grammatical word orders not accepted: sepv-27, psh-28, time-26, time-28.
- imp-20 "Sprechen Sie bitte langsam!": "langsamer" sounds more natural.

## Answer data

Not enough yet; both queries returned no rows.

```sql
select topic, item_id, count(*) as answers,
       round(100.0 * count(*) filter (where correct) / count(*)) as accuracy
from attempts where topic in (<18 A1 slugs>)
group by topic, item_id having count(*) >= 20 and
       100.0 * count(*) filter (where correct) / count(*) < 40
order by accuracy;
-- rows: []

select topic, item_id, answer, count(distinct user_id) as users
from attempts where topic in (<18 A1 slugs>) and not correct
group by topic, item_id, answer having count(distinct user_id) >= 3
order by users desc;
-- rows: []
```

## Checks

- `npm run sync:exercises`: synced 81 sets (no generated-file changes)
- `npm test`: 158/158 pass
- `npm run lint`: clean
- `bash e2e/all-practice-pages.sh` (local dev server): RESULT: PASS
- `git diff` shows no changed `"id"` lines
- PR, `ai-code-reviewer` and `/security-scan-changed`: not run yet. The owner asked to keep changes local until after the 2026-10-13 code review.
