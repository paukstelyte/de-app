Sources:
- https://openrouter.ai/docs/guides/overview/multimodal/pdfs (PDF Inputs)
- https://openrouter.ai/docs/guides/overview/multimodal/image-understanding (Image Inputs)
- https://openrouter.ai/docs/features/structured-outputs (Structured Outputs)
- https://openrouter.ai/docs/use-cases/usage-accounting (Usage Accounting)

Checked on 2026-10-10; sections 1, 3 and 6 updated 2026-10-14.

# Reading documents with OpenRouter: how DE-app uses it

Customized Learning sends one uploaded document (a PDF, up to 5 photos, or the text of a Word file) to a vision-capable model through OpenRouter's chat completions API and asks for a strict JSON answer. This page records what the OpenRouter documentation says and how `lib/learning/analyse.ts` applies it.

## 1. PDFs

**What the docs say.** A PDF is sent as a content part with `type: "file"`, whose `file` object has a `filename` and `file_data`: a public URL or a base64 data URL (`data:application/pdf;base64,...`). How the PDF is read is set with the `file-parser` plugin: `plugins: [{ "id": "file-parser", "pdf": { "engine": "..." } }]`. The engines are:

| Engine | What it does | Price |
|---|---|---|
| `native` | The model reads the PDF itself; only for models with native file input | Charged as normal input tokens |
| `mistral-ocr` | OCR, best for scanned or image-heavy PDFs | $2 per 1,000 pages |
| `cloudflare-ai` | Converts the PDF to markdown (replaces the deprecated `pdf-text`) | Free |

With no engine set, OpenRouter uses the model's native reading if it has one, otherwise it falls back to `mistral-ocr`.

**How DE-app uses it.** We always set `engine: "native"` explicitly, so a model change can never silently start paying for OCR. Gemini 2.5 Flash-Lite reads PDFs natively; a 1-page worksheet costs about 3,200 input tokens.

```ts
parts.push({ type: "file", file: { filename: f.name, file_data: `data:application/pdf;base64,${b64}` } });
// request body:
plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
```

Before calling the model, the app counts the pages with pdf-lib (`pdfPageCount` in `lib/learning/documents.ts`, which also counts pages stored in compressed object streams) and refuses PDFs over 20 pages, or a file pdf-lib can't open. The 10 MB limit and the daily upload limits cap the cost as well.

## 2. Photos

**What the docs say.** Images go in `image_url` content parts, either as a URL or as a base64 data URL (`data:image/jpeg;base64,...`). Base64 is the way for local or private files. Several images can be sent as separate parts, and the text prompt should come before them. Listed formats: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.

**How DE-app uses it.** Up to 5 photos are sent as separate base64 `image_url` parts in the document's user message (the instructions are in the system message; see section 6). The files come from the learner's private Supabase Storage folder, so URLs aren't an option. HEIC/HEIF (iPhone photos) isn't on OpenRouter's list, but we tested it with Gemini 2.5 Flash-Lite and it reads them correctly, so the app accepts them. A test with a blank image showed the model inventing text, so the prompt now requires an empty transcription and "no grammar" when there is no readable text, and a document with no readable text is refused as "unreadable" (not saved, still counted). The browser tests check that path with the fake OpenRouter (`e2e/learning.spec.ts`).

```ts
for (const f of input.files) parts.push({ type: "image_url", image_url: { url: `data:${f.mime};base64,${b64}` } });
```

## 3. Structured output

**What the docs say.** Set `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`. Support depends on the model and even the endpoint. With `strict: true` some providers guarantee schema-conforming output, while others treat the schema as a strong hint. A request fails if the model doesn't support it or the schema is invalid.

**How DE-app uses it.** `ANALYSIS_SCHEMA` in `lib/learning/suggestions.ts` requires `title`, `extractedText`, `noGrammar` and `topics[]` (each `slug`, `reason`, `fromMistake`), with no extra properties. Because strictness isn't guaranteed by every provider, the app never trusts the answer as-is. The schema is one Zod schema: `z.toJSONSchema` makes the JSON schema sent to the model and `safeParse` checks the answer, so the two can't drift apart. `parseAnalysis` then keeps only slugs from the 82-topic catalogue, removes duplicates, puts mistakes first, keeps at most 6, and trims long text. It returns one of four outcomes: topics found; "no grammar" (readable text with nothing to practise, saved as "No German grammar topics found"); "unreadable" (no text at all; not saved); and "invalid" (an answer that doesn't fit the schema, or names topics but none from the catalogue; not saved, shown as an error, never as "no grammar").

## 4. Usage and cost

**What the docs say.** Every response includes a `usage` object automatically, with `prompt_tokens`, `completion_tokens`, `total_tokens` and `cost` (credits charged). The old request option `usage: { include: true }` is deprecated and has no effect.

**How DE-app uses it.** `readUsage` in `lib/learning/usage.ts` takes `model`, `prompt_tokens`, `completion_tokens` and `cost` from the response, and keeps only values that pass the database's checks. They're stored with each document (`learning_documents.model`, `prompt_tokens`, `completion_tokens`, `cost_usd`). Each document card then shows e.g. "Read by Gemini 2.5 Flash Lite · 3,406 tokens · about $0.0004". These values are display-only and are never used for limits; the upload limits are counted separately in the database.

## 5. Keeping the key server-side

`OPENROUTER_API_KEY` is read only inside `analyseDocument` in `lib/learning/analyse.ts`, a module that starts with `import "server-only"`, so the build fails if browser code ever imports it. The browser never talks to OpenRouter. It uploads the file to Supabase Storage, then calls a server action with the file's path. The server downloads the file, calls OpenRouter, saves the result and deletes the file. The key is in `.env.local` locally and in Vercel's Production environment (marked Sensitive), never in a `NEXT_PUBLIC_` variable.

## 6. Prompt and document kept apart

The instructions and the topic catalogue are the **system message** (`SYSTEM_PROMPT` in `lib/learning/prompt.ts`, with a `PROMPT_VERSION` to bump on every wording change). The uploaded document goes in its own **user message**, introduced only as "The document to analyse:", and the system message tells the model to treat it as content, never as instructions, so text inside a worksheet can't change what the model is asked to do. The prompt asks for 1 to 6 well-supported topics rather than a minimum, so the model isn't pushed to pad the list.

## 7. Zero data retention

**What the docs say.** The `provider` object controls routing. `zdr: true` restricts a request to zero-data-retention endpoints; `data_collection: "deny"` (default `"allow"`) restricts it to providers that don't store or train on data. Source: [Provider routing](https://openrouter.ai/docs/features/provider-routing). OpenRouter itself doesn't train on API inputs and relies on standard contractual clauses for transfers out of the EU ([privacy policy](https://openrouter.ai/privacy), section 9).

**How DE-app uses it.** Every request sends `provider: { zdr: true }`, which is stricter than `data_collection: "deny"`. Checked on 2026-10-15: `google/gemini-2.5-flash-lite` still routes (to Google), and the real-model smoke test passes with it. The privacy page promises this, so never remove it. Zero data retention covers the model provider; OpenRouter itself keeps prompts only if "input/output logging" is on in the account's privacy settings, so keep it off. OpenRouter errors are logged as status and error code only, since the message can quote the document.

The browser tests run against a fake OpenRouter (`e2e/mock-openrouter.mjs`) that rejects a request breaking these rules: instructions not in a system message, the document not in its own user message, a non-strict schema, a PDF without the `native` engine, or a request without `provider.zdr`.

