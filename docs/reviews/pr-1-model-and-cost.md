# ai-code-reviewer report: PR #1

- **Pull request:** https://github.com/paukstelyte/de-app/pull/1 — "Show the AI model and cost of each document"
- **Branch:** `feature/model-and-cost` → `main`, reviewed at commit `b13f1ac`
- **Date:** 2026-10-10
- **Reviewer:** the `ai-code-reviewer` subagent (`.claude/agents/ai-code-reviewer.md`), run on the PR diff before merging
- **Reviewer's own checks:** `npm test` 126/126 passing, `npx tsc --noEmit` clean; no files edited

## Findings

### Critical
None.

### Warning
1. **Migration must be applied before the deploy.** The insert in `app/learning/actions.ts` now writes `model`, `prompt_tokens`, `completion_tokens` and `cost_usd`. If Vercel deploys before `20261010120000_learning_document_usage.sql` is on the database, every upload's insert fails after the quota and the OpenRouter cost were already spent.
2. **Usage columns are self-reportable.** The migration grants `authenticated` insert on the four columns, so a user calling the API directly could write any values on their own rows (within the CHECK constraints). RLS keeps it to their own rows; `cost_usd` must never be used for billing or quotas.

### Suggestion
1. `usageLine(doc)` is computed twice per render in `DocumentList.tsx`; hoist it to a `const`.
2. `UploadBox` receives both `modelName` and `modelSlug`, but the name is just `formatModel(slug)`; the client can format it itself (`usage.ts` has no imports).
3. `formatCost` can render exponent notation (`$3e-7`) for costs below $0.000001.
4. The doc comment on `usageLine` says "· $0.0004" but the code renders "· about $0.0004".
5. The test asserting `formatModel("anthropic/claude-sonnet-4-6") === "Claude Sonnet 4 6"` locks in an awkward result for a model the app doesn't use.
6. `cost_usd: number | string | null` is defensive but harmless (PostgREST may return `numeric` as a string).

No dead code found. `readUsage` mirrors the database CHECK constraints, so an odd OpenRouter response becomes nulls instead of a failed insert.

### Course-requirement checks
- **OpenRouter call server-side only: confirmed.** `lib/learning/analyse.ts` starts with `import "server-only"`; only `app/learning/actions.ts` (`"use server"`) and the server component `app/learning/page.tsx` (for the `ANALYSIS_MODEL` string) import it. No client component imports it.
- **`OPENROUTER_API_KEY` not browser-accessible: confirmed.** No `NEXT_PUBLIC_OPENROUTER*`; the key is read only inside `analyseDocument`; client components get only the model slug and display name.
- **RLS owner-scoped: confirmed.** The new columns are on `learning_documents`, whose select/insert/delete policies all require `auth.uid() = user_id`; inserts are column-granted, `anon` has nothing, and there is still no update grant.

## What was done about it

| Finding | Action |
|---|---|
| Warning 1 | Already handled: the migration was applied (`supabase db push`, dry-run first) before the PR was opened, and a real upload on the local app saved and showed the usage. |
| Warning 2 | Accepted. The values are display-only; `docs/supabase-schema.md` now says so explicitly. A privileged server-side write would add an admin client to the upload path for no user benefit. |
| Suggestions 1–5 | Fixed in a follow-up commit on the same PR: `usage` const, `UploadBox` takes only the slug, `formatCost` returns "under $0.000001" for tiny amounts (and the card drops "about" in that case), comment corrected, test case removed. |
| Suggestion 6 | Kept as is. |
