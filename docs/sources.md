# Sources

Reference material to consult while building this app.

## General

- https://nextjs.org/docs — official Next.js documentation (App Router, routing, data fetching, rendering, configuration).

## Layouts and Pages

- https://nextjs.org/docs/app/getting-started/layouts-and-pages — official Next.js App Router guide for creating pages, nested layouts, and linking between them. Use as the source of truth when building out the app's routes and page structure.


## AI (OpenRouter)

- https://openrouter.ai/docs/guides/overview/multimodal/pdfs — sending PDFs and the `file-parser` engines (we pin `native`).
- https://openrouter.ai/docs/guides/overview/multimodal/image-understanding — sending photos as base64 `image_url` parts.
- https://openrouter.ai/docs/features/structured-outputs — `response_format` with a strict JSON schema.
- https://openrouter.ai/docs/use-cases/usage-accounting — token counts and cost in every response.
- https://openrouter.ai/docs/features/provider-routing — `provider.zdr` (zero data retention) and `data_collection`.
- https://openrouter.ai/privacy — OpenRouter's privacy policy: no training on API inputs, standard contractual clauses for transfers out of the EU (section 9).

How the app applies these: [`openrouter-multimodal.md`](openrouter-multimodal.md).

## Supabase

- https://supabase.com/docs/guides/database/postgres/row-level-security — row-level security policies (every user-data table is owner-only).
- https://supabase.com/docs/guides/storage/security/access-control — Storage policies (each learner's private upload folder).

## Privacy

- https://vercel.com/docs/plans/hobby — Hobby plan limits, including 1 hour of runtime logs (the privacy page's "1 hour").
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance — Vertex AI data governance: no training on customer data, and what zero data retention needs.
