# To do

Open work, newest decisions first. Done items move to the PR that finished them (see `docs/reviews/`).

## Next: measure recommendation quality (reviewer feedback, step 6)

Waiting for real worksheets (the owner is collecting them; personal details removed first). Left out of PR #20 on purpose.

- **Evaluation set:** 12–20 human-reviewed documents: clean, teacher-corrected, ambiguous and unreadable, each labelled with the topics it practises and the real mistakes on it. Not committed if they contain anything personal.
- **Evaluation script:** runs the set through the real model and reports topic relevance and false "mistake" labels. About 1 cent per run. Run it before and after any prompt change.
- **Record per document:** prompt version (`PROMPT_VERSION` in `lib/learning/prompt.ts` already exists, not stored yet), response time and outcome, next to the stored model, tokens and cost. No raw documents in logs.
- **Learner correction:** let a learner mark a suggested mistake as "not my mistake", which removes the mistake boost for that topic in "Your focus now".

## Simplifications deferred from the 2026-10-14 code audit

It changes behaviour, so it needs its own PR.

- **One practice link per topic:** `topics.json` stores `exercises` as a list, but every topic has exactly one. Store a single link; update the sync script and the 5 pages that read it. Never rename a slug.

## Small leftovers from the PR #20 review

- One shared hook for values remembered in the browser: the level band (`lib/flashcards/level.ts`) and the auto-advance choice (`lib/useAdvance.ts`) repeat the same pattern.
- Release photo-preview URLs if the upload box closes while files are chosen (`components/learning/UploadBox.tsx`). Minor.

## Only when needed

- **Stats in SQL:** progress pages read a user's whole answer history (`lib/attempts.ts`). Move the summary into a database view or function once histories reach tens of thousands of answers. A new view needs RLS and the anon revoke.
- **CSP without `'unsafe-inline'` scripts:** per-request nonces via `proxy.ts` (`next.config.ts`), at the cost of rendering every page on request.
- **Email deliverability:** a custom sending domain instead of the Gmail sender on Brevo's free plan.
- **App-wide upload cap:** 100 uploads a day for everyone protects the AI budget, but about 10 accounts can use it up. Raise it with the budget.
