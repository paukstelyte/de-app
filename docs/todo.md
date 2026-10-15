# To do

Open work, newest decisions first. Done items move to the PR that finished them (see `docs/reviews/`).

## Next: measure recommendation quality (reviewer feedback, step 6)

Waiting for real worksheets (the owner is collecting them; personal details removed first). Left out of PR #20 on purpose.

- **Evaluation set:** 12–20 human-reviewed documents: clean, teacher-corrected, ambiguous and unreadable, each labelled with the topics it practises and the real mistakes on it. Not committed if they contain anything personal.
- **Evaluation script:** runs the set through the real model and reports topic relevance and false "mistake" labels. About 1 cent per run. Run it before and after any prompt change.
- **Record per document:** prompt version (`PROMPT_VERSION` in `lib/learning/prompt.ts` already exists, not stored yet), response time and outcome, next to the stored model, tokens and cost. No raw documents in logs.
- **Learner correction:** let a learner mark a suggested mistake as "not my mistake", which removes the mistake boost for that topic in "Your focus now".

## Open question: one practice link per topic

`topics.json` stores each topic's practice as a list (`exercises`), and every topic has exactly one item. Storing a single link instead would remove about 10 lines from the sync script and the 5 places that read it. Nothing is broken, so the owner decided (2026-10-14) to leave it as is unless it starts to affect code quality, or until it's clear whether any topic will get a second practice set (e.g. basic and advanced), in which case the list is the right shape.

Related, visible to learners: the Grammar Topics cards count that list and show "1 exercise", although each practice page has 30. Worth fixing on its own if the label bothers anyone.

## Privacy and AI Act follow-ups (from PR #30)

- **Legal review:** the privacy page and the AI labels follow two first-pass agent audits (`gdpr-compliance`, `eu-ai-act-compliance`), not a lawyer. Have them checked before any real launch.
- **Lawful basis for reading documents:** the privacy page uses consent (pressing "Read"); the reviewer noted it could also be part of the contract, and deleting a document doesn't undo the AI read. Ask the legal reviewer specifically.
- **OpenRouter's own logging:** zero data retention covers Google; OpenRouter keeps prompts only if "input/output logging" is on in the account's privacy settings. Keep it off.
- **Untested path:** account deletion stopping when upload clean-up fails has no automated test (the local setup can't make storage fail on purpose).
- **Exact log periods:** the privacy page says Vercel keeps request logs for 1 hour (Hobby plan); Supabase's and Brevo's own log periods aren't stated yet.
- **Screenshot:** `docs/screenshots/customized-learning.png` still shows the old "Read by …" label; retake it next time a real document is read.

## Only when needed

- **Stats in SQL:** progress pages read a user's whole answer history (`lib/attempts.ts`). Move the summary into a database view or function once histories reach tens of thousands of answers. A new view needs RLS and the anon revoke.
- **CSP without `'unsafe-inline'` scripts:** per-request nonces via `proxy.ts` (`next.config.ts`), at the cost of rendering every page on request.
- **CAPTCHA on sign-in and sign-up:** Supabase's built-in Cloudflare Turnstile support (free) would slow down password guessing spread over many addresses; today only the per-address rate limit does. Leaked-password protection would need the Pro plan.
- **Email deliverability:** a custom sending domain instead of the Gmail sender on Brevo's free plan.
- **App-wide upload cap:** 100 uploads a day for everyone protects the AI budget, but about 10 accounts can use it up. Raise it with the budget.
