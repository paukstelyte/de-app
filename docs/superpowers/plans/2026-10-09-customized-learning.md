# Customized Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logged-in learners upload a PDF, Word file or up to 5 photos of what they're learning; the app reads it with AI, suggests grammar topics from the fixed catalogue, keeps a "Your focus now" list with progress, and becomes the app's landing page.

**Architecture:** Pure, import-free logic (upload checks, AI-answer parsing, focus ranking, progress) lives in `lib/learning/*.ts` with Node tests. Files go from the browser straight into a private Supabase Storage bucket; a server action downloads them, reads Word files with a built-in zip/XML reader, sends the document to Gemini 2.5 Flash-Lite via OpenRouter with a strict JSON schema, saves the result and always deletes the files. The database enforces ownership (RLS), the upload quota and the document cap.

**Tech Stack:** Next.js 16 App Router (server actions), React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres + RLS, Storage), OpenRouter (`google/gemini-2.5-flash-lite`, structured outputs, file-parser `native`), `node:zlib`, `node:test`, playwright-cli for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-09-customized-learning-design.md`

## Global Constraints

- No new npm packages (CLAUDE.md). Word files are read with `node:zlib` + a small zip reader.
- OpenRouter is called only from server code; `OPENROUTER_API_KEY` never reaches the browser; server-only modules start with `import "server-only";`.
- Model: `google/gemini-2.5-flash-lite`, one constant in `lib/learning/analyse.ts`. PDFs: `plugins: [{ id: "file-parser", pdf: { engine: "native" } }]` — never omit the engine (the default falls back to paid OCR).
- Upload: one PDF, or one `.docx`, or 1–5 photos (JPG, PNG, WebP, HEIC, HEIF); ≤ 10 MB per file; PDFs ≤ 20 pages; extension is checked as well as the MIME type.
- Topics come only from `lib/grammar/topics.json`; 3–6 per document; mistakes first; each with a reason quoting the document (≤ 200 characters).
- No readable text or no German grammar → "No German grammar topics found", no topics.
- Uploaded files are deleted after every analysis, success or failure. Only title, extracted text (≤ 8,000 characters) and suggestions are stored.
- Limits: 10 uploads a day per user, 100 a day app-wide, 200 saved documents per user — enforced in the database.
- Focus window: 30 days. Every new table: RLS, `anon` revoked, explicit grants (CLAUDE.md, `docs/supabase-schema.md`).
- Show the exact SQL alongside any database query result (user preference).
- Supabase project ref `cenzahkgbbnmgzikxvsz`; apply migrations with `echo y | npx supabase db push --project-ref cenzahkgbbnmgzikxvsz` and confirm with the user first. The CLI is not linked; pass `--project-ref`.
- Test accounts: `test2@test.com` (main tester, may be reset) and `test@test.com` (only touch what the test creates), password from the user's memory notes, passed via environment variables, never committed.

## Review Focus

1. **A blank or unreadable photo**: the model must not invent text or topics. Pinned by the blank-image live check in Task 5 and the `noGrammar` handling test in Task 2.
2. **An HEIC photo whose browser MIME type is empty** (common on desktop): must still be accepted by extension and stored with the right content type. Pinned by the `validateSelection` tests in Task 1.
3. **Another user's storage path passed to the server action** (forged request): must be refused before anything is downloaded. Pinned by `ownedPaths` tests in Task 1 and the storage policy SQL test in Task 4.
4. **The AI suggests a slug that isn't in the catalogue, or the same topic twice**: dropped/deduplicated, never shown. Pinned by `parseAnalysis` tests in Task 2.
5. **A failure after upload (quota hit, AI down, unreadable Word file)**: the uploaded files are still deleted and the user sees a plain message. Pinned by the `finally` cleanup in Task 6 and the e2e "storage is empty afterwards" check in Task 10.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/learning/uploads.ts` (+ test) | Upload rules: allowed kinds, sizes, counts, MIME-by-extension, storage paths, `ownedPaths` |
| `lib/learning/suggestions.ts` (+ test) | JSON schema for the AI, `parseAnalysis` (validate, drop unknown slugs, dedupe, order, cap) |
| `lib/learning/focus.ts` (+ test) | `buildFocus`: combine recent documents and manual add/remove into "Your focus now" |
| `lib/learning/progress.ts` (+ test) | `topicProgress`: per-topic answers, accuracy, last practised from `attempts` rows |
| `lib/learning/docx.ts` (+ test, fixture) | Extract plain text from a `.docx` with `node:zlib` |
| `lib/learning/analyse.ts` | Server-only OpenRouter call (prompt with catalogue, file parts, strict schema) |
| `supabase/migrations/20261010100000_customized_learning.sql` | Tables, quota, cap, storage bucket and policies |
| `app/learning/actions.ts` | Server actions: `analyseUpload`, `deleteDocument`, `setFocus` |
| `app/learning/page.tsx` | The page (guest message / upload / focus / documents / empty state) |
| `components/learning/*.tsx` | `UploadBox`, `FocusList`, `DocumentList`, `FocusButton` |
| Changed | `lib/safe-redirect.ts` (fallback), `app/page.tsx` (landing + guest front page), `components/NavBar.tsx`, `app/topics/[slug]/page.tsx` (add to focus), `app/privacy/page.tsx`, `docs/supabase-schema.md`, `supabase/templates/confirmation.html` |
| `e2e/learning.sh`, `e2e/lib.sh`, `e2e/fixtures/*` | Browser checks with playwright-cli |

---

### Task 1: Upload rules (`lib/learning/uploads.ts`)

**Files:** Create `lib/learning/uploads.ts`, `lib/learning/uploads.test.mjs`

**Interfaces:**
- Produces: `MAX_FILE_BYTES = 10 * 1024 * 1024`, `MAX_PHOTOS = 5`, `MAX_PDF_PAGES = 20`, `BUCKET = "learning-uploads"`, `type UploadKind = "pdf" | "docx" | "images"`, `type FileInfo = { name: string; size: number; type: string }`, `validateSelection(files: FileInfo[]): { kind: UploadKind } | { error: string }`, `mimeFor(file: FileInfo): string | null`, `storagePath(userId: string, batchId: string, index: number, fileName: string): string`, `ownedPaths(paths: unknown, userId: string): string[] | null`, `UPLOAD_NOTE: string`.

- [ ] **Step 1: Write the failing tests** — `lib/learning/uploads.test.mjs`:

```js
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_FILE_BYTES, mimeFor, ownedPaths, storagePath, validateSelection } from "./uploads.ts";

const f = (name, size = 1000, type = "") => ({ name, size, type });
const UID = "4a8a0fe2-22b4-4266-88eb-f214f6c7af2e";

test("one PDF or one Word file is accepted", () => {
  assert.deepEqual(validateSelection([f("Lektion 7.pdf", 1000, "application/pdf")]), { kind: "pdf" });
  assert.deepEqual(validateSelection([f("notes.DOCX")]), { kind: "docx" });
});

test("1 to 5 photos are accepted, including HEIC with an empty browser type", () => {
  assert.deepEqual(validateSelection([f("a.jpg", 1, "image/jpeg"), f("b.HEIC")]), { kind: "images" });
  assert.deepEqual(validateSelection([1, 2, 3, 4, 5].map((i) => f(`p${i}.png`, 1, "image/png"))), { kind: "images" });
});

test("rejects: nothing, 6 photos, mixed kinds, two PDFs, too big, unsupported", () => {
  assert.match(validateSelection([]).error, /Choose/);
  assert.match(validateSelection([1, 2, 3, 4, 5, 6].map((i) => f(`p${i}.jpg`))).error, /5 photos/);
  assert.match(validateSelection([f("a.pdf"), f("b.jpg")]).error, /one PDF, one Word file or up to 5 photos/);
  assert.match(validateSelection([f("a.pdf"), f("b.pdf")]).error, /one PDF, one Word file or up to 5 photos/);
  assert.match(validateSelection([f("a.pdf", MAX_FILE_BYTES + 1)]).error, /10 MB/);
  assert.match(validateSelection([f("old.doc")]).error, /PDF, Word \(.docx\), JPG, PNG, WebP or HEIC/);
  assert.match(validateSelection([f("x.gif", 1, "image/gif")]).error, /PDF, Word/);
});

test("mimeFor trusts the extension and fills in an empty browser type", () => {
  assert.equal(mimeFor(f("a.heic")), "image/heic");
  assert.equal(mimeFor(f("a.HEIF")), "image/heif");
  assert.equal(mimeFor(f("a.jpeg", 1, "")), "image/jpeg");
  assert.equal(mimeFor(f("a.docx")), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(mimeFor(f("a.exe", 1, "image/png")), null);
});

test("storagePath keeps files in the user's own folder with a safe name", () => {
  assert.equal(storagePath(UID, "b1", 0, "Lektion 7 (neu).PDF"), `${UID}/b1/0.pdf`);
});

test("ownedPaths only accepts 1–5 paths inside the caller's folder", () => {
  const ok = [`${UID}/b1/0.jpg`, `${UID}/b1/1.heic`];
  assert.deepEqual(ownedPaths(ok, UID), ok);
  assert.equal(ownedPaths([`someone-else/b1/0.jpg`], UID), null);
  assert.equal(ownedPaths([`${UID}/../x/0.jpg`], UID), null);
  assert.equal(ownedPaths([`${UID}/b1/0.exe`], UID), null);
  assert.equal(ownedPaths([], UID), null);
  assert.equal(ownedPaths("nope", UID), null);
  assert.equal(ownedPaths(Array(6).fill(`${UID}/b1/0.jpg`), UID), null);
});
```

- [ ] **Step 2: Run to verify they fail** — `npm test` → FAIL: `Cannot find module '…/lib/learning/uploads.ts'`.

- [ ] **Step 3: Implement** — `lib/learning/uploads.ts`:

```ts
// What can be uploaded to Customized Learning, and where it's stored.
// No imports, so `npm test` can load it straight into Node.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 5;
export const MAX_PDF_PAGES = 20;
export const BUCKET = "learning-uploads";
export type UploadKind = "pdf" | "docx" | "images";
export type FileInfo = { name: string; size: number; type: string };

export const UPLOAD_NOTE =
  "Upload printed or typed learning material, such as textbook pages, worksheets, typed notes or homework, as a PDF, Word file or up to 5 photos (JPG/PNG/HEIC). Handwriting isn't supported. Don't upload documents with personal details.";

const MIME_BY_EXT: Record<string, { mime: string; kind: "pdf" | "docx" | "image" }> = {
  pdf: { mime: "application/pdf", kind: "pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "docx" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  heic: { mime: "image/heic", kind: "image" },
  heif: { mime: "image/heif", kind: "image" },
};
export const ALLOWED_MIME_TYPES = [...new Set(Object.values(MIME_BY_EXT).map((v) => v.mime))];

const extOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** The MIME type for a file, decided by its extension (browsers often leave HEIC blank). */
export function mimeFor(file: FileInfo): string | null {
  return MIME_BY_EXT[extOf(file.name)]?.mime ?? null;
}

export function validateSelection(files: FileInfo[]): { kind: UploadKind } | { error: string } {
  if (files.length === 0) return { error: "Choose a PDF, a Word file or up to 5 photos." };
  const kinds = files.map((f) => MIME_BY_EXT[extOf(f.name)]?.kind);
  if (kinds.some((k) => !k)) return { error: "Please upload a PDF, Word (.docx), JPG, PNG, WebP or HEIC file." };
  if (files.some((f) => f.size > MAX_FILE_BYTES)) return { error: "Each file must be 10 MB or smaller." };
  if (kinds.every((k) => k === "image")) {
    return files.length <= MAX_PHOTOS ? { kind: "images" } : { error: "Upload at most 5 photos at a time." };
  }
  if (files.length === 1) return { kind: kinds[0] as "pdf" | "docx" };
  return { error: "Upload one PDF, one Word file or up to 5 photos at a time." };
}

/** Where a file goes in the bucket: <user id>/<batch id>/<index>.<ext>. */
export function storagePath(userId: string, batchId: string, index: number, fileName: string): string {
  return `${userId}/${batchId}/${index}.${extOf(fileName)}`;
}

/** The browser's list of uploaded paths is untrusted: 1–5 paths, all inside the
 * caller's own folder, with an allowed extension and no tricks. */
export function ownedPaths(paths: unknown, userId: string): string[] | null {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PHOTOS) return null;
  const pattern = new RegExp(`^${userId}/[A-Za-z0-9-]{1,64}/[0-9]\\.(${Object.keys(MIME_BY_EXT).join("|")})$`);
  return paths.every((p) => typeof p === "string" && pattern.test(p)) ? (paths as string[]) : null;
}
```

- [ ] **Step 4: Run tests** — `npm test && npx tsc --noEmit` → all pass, no type errors.
- [ ] **Step 5: Commit** — `git add lib/learning/uploads.ts lib/learning/uploads.test.mjs && git commit -m "Add upload rules for Customized Learning"`

---

### Task 2: Parsing the AI's answer (`lib/learning/suggestions.ts`)

**Files:** Create `lib/learning/suggestions.ts`, `lib/learning/suggestions.test.mjs`

**Interfaces:**
- Produces: `ANALYSIS_SCHEMA` (JSON schema object for OpenRouter `response_format`), `type Suggestion = { slug: string; reason: string; fromMistake: boolean }`, `type Analysis = { title: string; extractedText: string; noGrammar: boolean; topics: Suggestion[] }`, `parseAnalysis(raw: unknown, knownSlugs: Set<string>): Analysis | null`, `MAX_TEXT = 8000`, `MAX_TOPICS = 6`.

- [ ] **Step 1: Failing tests** — `lib/learning/suggestions.test.mjs`:

```js
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ANALYSIS_SCHEMA, MAX_TEXT, parseAnalysis } from "./suggestions.ts";

const KNOWN = new Set(["dative-case", "prepositions-dative", "perfect-tense", "noun-gender", "accusative-case", "plural-nouns", "imperative"]);
const t = (slug, fromMistake = false, reason = "because") => ({ slug, fromMistake, reason });
const raw = (topics, extra = {}) => ({ title: "Lektion 7", extractedText: "mit dem Bus", noGrammar: false, topics, ...extra });

test("keeps known topics, mistakes first, original order otherwise", () => {
  const a = parseAnalysis(raw([t("dative-case"), t("perfect-tense", true), t("prepositions-dative")]), KNOWN);
  assert.deepEqual(a.topics.map((x) => x.slug), ["perfect-tense", "dative-case", "prepositions-dative"]);
});

test("drops unknown slugs and duplicates, caps at 6", () => {
  const many = ["dative-case", "made-up-topic", "dative-case", "noun-gender", "accusative-case", "plural-nouns", "imperative", "perfect-tense", "prepositions-dative"].map((s) => t(s));
  const a = parseAnalysis(raw(many), KNOWN);
  assert.equal(a.topics.length, 6);
  assert.ok(!a.topics.some((x) => x.slug === "made-up-topic"));
  assert.equal(new Set(a.topics.map((x) => x.slug)).size, 6);
});

test("trims long reasons, titles and text", () => {
  const a = parseAnalysis(raw([t("dative-case", false, "x".repeat(500))], { title: "T".repeat(300), extractedText: "y".repeat(MAX_TEXT + 50) }), KNOWN);
  assert.equal(a.topics[0].reason.length, 200);
  assert.equal(a.title.length, 80);
  assert.equal(a.extractedText.length, MAX_TEXT);
});

test("no topics left means noGrammar, even if the model said otherwise", () => {
  const a = parseAnalysis(raw([t("made-up-topic")]), KNOWN);
  assert.equal(a.noGrammar, true);
  assert.deepEqual(a.topics, []);
});

test("noGrammar from the model clears any topics", () => {
  const a = parseAnalysis(raw([t("dative-case")], { noGrammar: true }), KNOWN);
  assert.equal(a.noGrammar, true);
  assert.deepEqual(a.topics, []);
});

test("an empty title falls back to a neutral one", () => {
  assert.equal(parseAnalysis(raw([t("dative-case")], { title: "  " }), KNOWN).title, "Untitled document");
});

test("malformed answers are rejected", () => {
  for (const bad of [null, "text", {}, { title: "x" }, raw("nope"), raw([{ slug: 5 }])]) assert.equal(parseAnalysis(bad, KNOWN), null);
});

test("the schema is strict and lists the four fields", () => {
  assert.equal(ANALYSIS_SCHEMA.strict, true);
  assert.deepEqual(ANALYSIS_SCHEMA.schema.required, ["title", "extractedText", "noGrammar", "topics"]);
});
```

- [ ] **Step 2: Run** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/learning/suggestions.ts`:

```ts
// The AI's answer for an uploaded document: the JSON schema it must follow and
// the checks applied to it. No imports, so `npm test` can load it into Node.

export const MAX_TEXT = 8000;
export const MAX_TOPICS = 6;
export type Suggestion = { slug: string; reason: string; fromMistake: boolean };
export type Analysis = { title: string; extractedText: string; noGrammar: boolean; topics: Suggestion[] };

/** OpenRouter structured output: the model must answer in exactly this shape. */
export const ANALYSIS_SCHEMA = {
  name: "document_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "extractedText", "noGrammar", "topics"],
    properties: {
      title: { type: "string", description: "Short title for the document, max 80 characters" },
      extractedText: { type: "string", description: "The text read from the document, max 8000 characters; empty if none" },
      noGrammar: { type: "boolean", description: "True if there is no readable text or no German grammar" },
      topics: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slug", "reason", "fromMistake"],
          properties: {
            slug: { type: "string", description: "A slug from the topic list, exactly as given" },
            reason: { type: "string", description: "One line quoting the document" },
            fromMistake: { type: "boolean", description: "True if the document shows a mistake on this topic" },
          },
        },
      },
    },
  },
} as const;

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Validates the model's answer; drops topics outside the catalogue and
 * duplicates; puts mistakes first; keeps at most 6. Null if malformed. */
export function parseAnalysis(raw: unknown, knownSlugs: Set<string>): Analysis | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object" || typeof r.title !== "string" || typeof r.noGrammar !== "boolean" || !Array.isArray(r.topics)) {
    return null;
  }
  if (r.topics.some((x) => !x || typeof (x as Suggestion).slug !== "string")) return null;
  const seen = new Set<string>();
  const topics = (r.topics as Suggestion[])
    .filter((x) => knownSlugs.has(x.slug) && !seen.has(x.slug) && seen.add(x.slug))
    .map((x) => ({ slug: x.slug, reason: clip(x.reason, 200), fromMistake: x.fromMistake === true }))
    .sort((a, b) => Number(b.fromMistake) - Number(a.fromMistake))
    .slice(0, MAX_TOPICS);
  const noGrammar = r.noGrammar === true || topics.length === 0;
  return {
    title: clip(r.title, 80) || "Untitled document",
    extractedText: clip(r.extractedText, MAX_TEXT),
    noGrammar,
    topics: noGrammar ? [] : topics,
  };
}
```

- [ ] **Step 4: Run** — `npm test && npx tsc --noEmit` → pass.
- [ ] **Step 5: Commit** — `git commit -m "Add parsing and checks for the AI's topic suggestions"`

---

### Task 3: Focus list and progress (`lib/learning/focus.ts`, `lib/learning/progress.ts`)

**Files:** Create `lib/learning/focus.ts`, `lib/learning/progress.ts`, `lib/learning/focus.test.mjs`

**Interfaces:**
- Consumes: `Suggestion` (Task 2).
- Produces: `FOCUS_DAYS = 30`; `type FocusDoc = { id: number; title: string; createdAt: string; topics: Suggestion[] }`; `type FocusOverride = { slug: string; kind: "added" | "removed"; updatedAt: string }`; `type FocusItem = { slug: string; mistakes: number; documents: number; since: string; fromTitle: string | null; added: boolean }`; `buildFocus(docs, overrides, now: Date): FocusItem[]`. `ATTEMPT_TOPIC_SLUG: Record<string, string>` (`{ articles: "noun-gender" }`); `type TopicProgress = { total: number; correct: number; lastPractised: string | null }`; `topicProgress(rows: { topic: string; correct: boolean; created_at: string }[]): Record<string, TopicProgress>`.

- [ ] **Step 1: Failing tests** — `lib/learning/focus.test.mjs`:

```js
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFocus } from "./focus.ts";
import { topicProgress } from "./progress.ts";

const NOW = new Date("2026-10-20T12:00:00Z");
const s = (slug, fromMistake = false) => ({ slug, reason: "r", fromMistake });
const doc = (id, date, topics, title = `Doc ${id}`) => ({ id, title, createdAt: date, topics });

test("combines recent documents: mistakes first, then how many documents, then most recent", () => {
  const items = buildFocus([
    doc(1, "2026-10-01T10:00:00Z", [s("dative-case"), s("perfect-tense")]),
    doc(2, "2026-10-15T10:00:00Z", [s("dative-case"), s("accusative-case", true)]),
  ], [], NOW);
  assert.deepEqual(items.map((i) => i.slug), ["accusative-case", "dative-case", "perfect-tense"]);
  const dative = items.find((i) => i.slug === "dative-case");
  assert.equal(dative.documents, 2);
  assert.equal(dative.since, "2026-10-01T10:00:00Z");
  assert.equal(dative.fromTitle, "Doc 1");
});

test("documents older than 30 days drop out of the focus", () => {
  const items = buildFocus([doc(1, "2026-09-10T10:00:00Z", [s("dative-case")])], [], NOW);
  assert.deepEqual(items, []);
});

test("a removed topic stays hidden until a newer document suggests it again", () => {
  const docs = [doc(1, "2026-10-10T10:00:00Z", [s("dative-case")])];
  assert.deepEqual(buildFocus(docs, [{ slug: "dative-case", kind: "removed", updatedAt: "2026-10-12T10:00:00Z" }], NOW), []);
  const later = [...docs, doc(2, "2026-10-14T10:00:00Z", [s("dative-case")])];
  assert.equal(buildFocus(later, [{ slug: "dative-case", kind: "removed", updatedAt: "2026-10-12T10:00:00Z" }], NOW).length, 1);
});

test("a topic added by hand shows even without documents, after suggested ones", () => {
  const items = buildFocus([doc(1, "2026-10-10T10:00:00Z", [s("dative-case")])], [{ slug: "modal-verbs", kind: "added", updatedAt: "2026-10-11T10:00:00Z" }], NOW);
  assert.deepEqual(items.map((i) => [i.slug, i.added]), [["dative-case", false], ["modal-verbs", true]]);
  assert.equal(items[1].fromTitle, null);
});

test("topicProgress maps the flashcard topic to noun-gender and counts answers", () => {
  const p = topicProgress([
    { topic: "articles", correct: true, created_at: "2026-10-01T10:00:00Z" },
    { topic: "articles", correct: false, created_at: "2026-10-03T10:00:00Z" },
    { topic: "unknown", correct: true, created_at: "2026-10-03T10:00:00Z" },
  ]);
  assert.deepEqual(p, { "noun-gender": { total: 2, correct: 1, lastPractised: "2026-10-03T10:00:00Z" } });
});
```

- [ ] **Step 2: Run** — `npm test` → FAIL.

- [ ] **Step 3: Implement** — `lib/learning/focus.ts`:

```ts
// "Your focus now": the topics from recent uploads, combined, plus the
// learner's own additions and removals. Type-only import, so Node can load it.
import type { Suggestion } from "./suggestions";

export const FOCUS_DAYS = 30;
export type FocusDoc = { id: number; title: string; createdAt: string; topics: Suggestion[] };
export type FocusOverride = { slug: string; kind: "added" | "removed"; updatedAt: string };
export type FocusItem = { slug: string; mistakes: number; documents: number; since: string; fromTitle: string | null; added: boolean };

export function buildFocus(docs: FocusDoc[], overrides: FocusOverride[], now: Date): FocusItem[] {
  const cutoff = now.getTime() - FOCUS_DAYS * 24 * 60 * 60 * 1000;
  const recent = docs.filter((d) => Date.parse(d.createdAt) >= cutoff).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const removedAt = new Map(overrides.filter((o) => o.kind === "removed").map((o) => [o.slug, o.updatedAt]));

  const bySlug = new Map<string, FocusItem & { latest: string }>();
  for (const d of recent) {
    for (const t of d.topics) {
      const item = bySlug.get(t.slug) ?? { slug: t.slug, mistakes: 0, documents: 0, since: d.createdAt, fromTitle: d.title, added: false, latest: d.createdAt };
      item.documents += 1;
      item.mistakes += t.fromMistake ? 1 : 0;
      item.latest = d.createdAt;
      bySlug.set(t.slug, item);
    }
  }
  const suggested = [...bySlug.values()]
    .filter((i) => !(removedAt.has(i.slug) && removedAt.get(i.slug)! >= i.latest))
    .sort((a, b) => b.mistakes - a.mistakes || b.documents - a.documents || b.latest.localeCompare(a.latest))
    .map(({ latest: _latest, ...item }) => item);

  const added = overrides
    .filter((o) => o.kind === "added" && !bySlug.has(o.slug))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((o) => ({ slug: o.slug, mistakes: 0, documents: 0, since: o.updatedAt, fromTitle: null, added: true }));
  return [...suggested, ...added];
}
```

`lib/learning/progress.ts`:

```ts
// Per-topic progress from the answer history (public.attempts). The attempts
// table names topics its own way; map them to catalogue slugs here.

export const ATTEMPT_TOPIC_SLUG: Record<string, string> = { articles: "noun-gender" };
export type TopicProgress = { total: number; correct: number; lastPractised: string | null };

export function topicProgress(rows: { topic: string; correct: boolean; created_at: string }[]): Record<string, TopicProgress> {
  const out: Record<string, TopicProgress> = {};
  for (const r of rows) {
    const slug = ATTEMPT_TOPIC_SLUG[r.topic];
    if (!slug) continue;
    const p = (out[slug] ??= { total: 0, correct: 0, lastPractised: null });
    p.total += 1;
    p.correct += r.correct ? 1 : 0;
    if (!p.lastPractised || r.created_at > p.lastPractised) p.lastPractised = r.created_at;
  }
  return out;
}
```

- [ ] **Step 4: Run** — `npm test && npx tsc --noEmit && npm run lint` → pass. (If lint flags the unused `_latest`, use `const { latest, ...item } = i; void latest; return item;`.)
- [ ] **Step 5: Commit** — `git commit -m "Add focus list and per-topic progress logic"`

---

### Task 4: Database and storage (`supabase/migrations/20261010100000_customized_learning.sql`)

**Files:** Create the migration; modify `docs/supabase-schema.md`

**Interfaces:**
- Produces: tables `public.learning_documents` (`id bigint`, `user_id uuid`, `title text`, `extracted_text text`, `no_grammar boolean`, `suggestions jsonb`, `created_at timestamptz`), `public.learning_focus` (`user_id`, `topic_slug`, `kind`, `updated_at`; PK `(user_id, topic_slug)`), `public.learning_upload_usage`; function `public.use_upload_quota()` (raises `P0001` "Upload limit reached"); trigger cap 200 (`P0001` "Document limit reached"); private bucket `learning-uploads` with per-user-folder policies.

- [ ] **Step 1: Write the failing SQL test** (scratchpad, rolled back) — `learning-test.sql`:

```sql
begin;
create temp table results (step int, check_name text, expected text, result text) on commit drop;
grant all on results to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'test2@test.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare state text; i int; uid uuid := auth.uid();
begin
  begin insert into public.learning_documents (title, extracted_text, no_grammar, suggestions)
          values ('T', 'x', false, '[{"slug":"dative-case","reason":"r","fromMistake":false}]'); state := 'accepted';
  exception when others then state := sqlstate; end;
  insert into results values (1, 'user saves a document', 'accepted', state);
  begin for i in 1..10 loop perform public.use_upload_quota(); end loop;
    begin perform public.use_upload_quota(); state := 'accepted'; exception when others then state := sqlstate; end;
  exception when others then state := 'missing: ' || sqlstate; end;
  insert into results values (2, '11th upload in a day', 'P0001', state);
  begin insert into public.learning_focus (topic_slug, kind) values ('dative-case', 'removed'); state := 'accepted';
  exception when others then state := sqlstate; end;
  insert into results values (3, 'user sets a focus override', 'accepted', state);
  begin insert into storage.objects (bucket_id, name) values ('learning-uploads', 'someone-else/b/0.pdf'); state := 'accepted';
  exception when others then state := sqlstate; end;
  insert into results values (4, 'upload into another user''s folder', '42501', state);
end $$;
insert into results select 5, 'documents limit trigger exists', 'yes', case when exists (select 1 from pg_trigger where tgname = 'learning_documents_limit') then 'yes' else 'no' end;
insert into results select 6, 'bucket is private, 10 MB', 'false 10485760', (select public::text || ' ' || file_size_limit from storage.buckets where id = 'learning-uploads');
select * from results order by step;
rollback;
```

Run: `npx supabase db query --project-ref cenzahkgbbnmgzikxvsz -f learning-test.sql` → expect failures (relations missing).

- [ ] **Step 2: Write the migration** — `supabase/migrations/20261010100000_customized_learning.sql`:

```sql
-- Customized Learning: saved documents with AI topic suggestions, the
-- learner's focus overrides, an upload quota, and a private bucket for files
-- in transit (the server deletes them right after reading).

create table public.learning_documents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  extracted_text text not null default '' check (char_length(extracted_text) <= 8000),
  no_grammar boolean not null default false,
  suggestions jsonb not null default '[]' check (jsonb_typeof(suggestions) = 'array' and jsonb_array_length(suggestions) <= 6),
  created_at timestamptz not null default now()
);
create index learning_documents_user_created_idx on public.learning_documents (user_id, created_at desc);
alter table public.learning_documents enable row level security;
create policy "Users read their own documents" on public.learning_documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own documents" on public.learning_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete their own documents" on public.learning_documents
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learning_documents from anon, authenticated;
grant select, delete on public.learning_documents to authenticated;
grant insert (title, extracted_text, no_grammar, suggestions) on public.learning_documents to authenticated;

-- At most 200 saved documents per user (also for direct API inserts).
create function public.enforce_learning_documents_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.learning_documents where user_id = new.user_id) >= 200 then
    raise exception 'Document limit reached (200 documents)' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger learning_documents_limit before insert on public.learning_documents
  for each row execute function public.enforce_learning_documents_limit();
revoke execute on function public.enforce_learning_documents_limit() from public, anon, authenticated;

-- Focus overrides: one row per user and topic, "added" by hand or "removed".
create table public.learning_focus (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_slug text not null check (topic_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(topic_slug) <= 64),
  kind text not null check (kind in ('added', 'removed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_slug)
);
alter table public.learning_focus enable row level security;
create policy "Users read their own focus" on public.learning_focus
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own focus" on public.learning_focus
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own focus" on public.learning_focus
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own focus" on public.learning_focus
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learning_focus from anon, authenticated;
grant select, delete on public.learning_focus to authenticated;
grant insert (topic_slug, kind, updated_at), update (kind, updated_at) on public.learning_focus to authenticated;

-- Upload quota: 10 a day per user, 100 a day for everyone (AI costs money).
create table public.learning_upload_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index learning_upload_usage_created_idx on public.learning_upload_usage (created_at);
alter table public.learning_upload_usage enable row level security;
revoke all on public.learning_upload_usage from anon, authenticated;

create function public.use_upload_quota() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('learning_upload_usage'));
  if (select count(*) from public.learning_upload_usage where user_id = uid and created_at > now() - interval '24 hours') >= 10
     or (select count(*) from public.learning_upload_usage where created_at > now() - interval '24 hours') >= 100 then
    raise exception 'Upload limit reached' using errcode = 'P0001';
  end if;
  insert into public.learning_upload_usage (user_id) values (uid);
end; $$;
revoke execute on function public.use_upload_quota() from public, anon;
grant execute on function public.use_upload_quota() to authenticated;

-- Private bucket for files in transit; each user may only touch <their id>/…
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learning-uploads', 'learning-uploads', false, 10485760, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
]);
create policy "Users upload into their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users read their own uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

- [ ] **Step 3: Apply (ask the user first)** — `echo y | npx supabase db push --project-ref cenzahkgbbnmgzikxvsz`. If `insert into storage.buckets` or the storage policies are refused for permission reasons, stop and report: the bucket and policies can then be created in the Supabase dashboard (Storage → New bucket; Policies) with the same values.
- [ ] **Step 4: Run the SQL test again** → expected: 1 accepted, 2 P0001, 3 accepted, 4 42501, 5 yes, 6 `false 10485760`. Show the SQL with the results.
- [ ] **Step 5: Document** — add a `public.learning_documents`, `public.learning_focus`, `public.learning_upload_usage` and storage section to `docs/supabase-schema.md` (columns, access rules table, limits, bucket).
- [ ] **Step 6: Commit** — `git commit -m "Add Customized Learning tables, upload quota and private upload bucket"`

---

### Task 5: Word reader and the AI call (`lib/learning/docx.ts`, `lib/learning/analyse.ts`)

**Files:** Create `lib/learning/docx.ts`, `lib/learning/docx.test.mjs`, `lib/learning/fixtures/sample.docx` (made with `textutil -convert docx` from: "Lektion 7: Präpositionen mit Dativ / aus, bei, mit, nach, seit, von, zu / Ich fahre mit dem Bus zur Arbeit."), `lib/learning/analyse.ts`

**Interfaces:**
- Produces: `extractDocxText(buf: Buffer): string | null`; `analyseDocument(input: { kind: UploadKind; files: { name: string; mime: string; data: Buffer }[]; docxText?: string }): Promise<{ analysis: Analysis } | { error: "ai" | "unreadable" }>`; `ANALYSIS_MODEL`.

- [ ] **Step 1: Failing test** — `lib/learning/docx.test.mjs`:

```js
// Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractDocxText } from "./docx.ts";

test("reads the text and paragraph breaks of a real Word file", () => {
  const text = extractDocxText(readFileSync(new URL("./fixtures/sample.docx", import.meta.url)));
  assert.match(text, /Lektion 7: Präpositionen mit Dativ/);
  assert.match(text, /aus, bei, mit, nach, seit, von, zu/);
  assert.match(text, /Ich fahre mit dem Bus zur Arbeit\./);
  assert.ok(text.split("\n").length >= 3);
});

test("returns null for files that aren't Word documents", () => {
  assert.equal(extractDocxText(Buffer.from("not a zip")), null);
  assert.equal(extractDocxText(Buffer.alloc(0)), null);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `lib/learning/docx.ts`:

```ts
// Reads the plain text of a .docx (a zip with word/document.xml) using only
// node:zlib, so no package is needed. Returns null for anything it can't read.
import { inflateRawSync } from "node:zlib";

function findEntry(buf: Buffer, wanted: string): Buffer | null {
  // End of central directory record: last 22+ bytes, signature 0x06054b50.
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > buf.length) return null;
  let ptr = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count && ptr + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(ptr + 10);
    const size = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const local = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
    if (name === wanted) {
      if (buf.readUInt32LE(local) !== 0x04034b50) return null;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

export function extractDocxText(buf: Buffer): string | null {
  try {
    const xml = findEntry(buf, "word/document.xml")?.toString("utf8");
    if (!xml) return null;
    const text = xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>|<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run** → pass. **Step 5: Implement** `lib/learning/analyse.ts`:

```ts
import "server-only"; // reads OPENROUTER_API_KEY
import { TOPICS } from "@/lib/grammar/topics";
import { ANALYSIS_SCHEMA, parseAnalysis, type Analysis } from "@/lib/learning/suggestions";
import type { UploadKind } from "@/lib/learning/uploads";

// One fixed model (agreed): reads PDFs and photos itself, about $0.0004 per document.
export const ANALYSIS_MODEL = "google/gemini-2.5-flash-lite";
const KNOWN = new Set(TOPICS.map((t) => t.slug));
const CATALOGUE = TOPICS.map((t) => `${t.slug} | ${t.level} | ${t.title}`).join("\n");

const PROMPT = `You help a learner of German. Read the attached document (a textbook page, worksheet, notes or homework).
1. extractedText: transcribe the document's text (max 8000 characters). If there is no readable text, use "" and never invent text.
2. noGrammar: true if there is no readable text or the document contains no German grammar.
3. topics: 3 to 6 grammar topics the learner should practise, chosen ONLY from this list (use the slug exactly):
${CATALOGUE}
Base topics ONLY on what is in the document. Put topics where the document shows a mistake (for example a teacher's correction) first and set fromMistake to true. For each topic give a one-line reason that quotes the document.
4. title: a short title for the document, for example "Textbook p. 34: dative prepositions".`;

export async function analyseDocument(input: {
  kind: UploadKind;
  files: { name: string; mime: string; data: Buffer }[];
  docxText?: string;
}): Promise<{ analysis: Analysis } | { error: "ai" | "unreadable" }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("analyseDocument: OPENROUTER_API_KEY is not set");
    return { error: "ai" };
  }
  const parts: object[] = [{ type: "text", text: PROMPT }];
  if (input.kind === "docx") {
    if (!input.docxText?.trim()) return { error: "unreadable" };
    parts.push({ type: "text", text: `Document text:\n${input.docxText.slice(0, 20000)}` });
  } else if (input.kind === "pdf") {
    const f = input.files[0];
    parts.push({ type: "file", file: { filename: f.name, file_data: `data:application/pdf;base64,${f.data.toString("base64")}` } });
  } else {
    for (const f of input.files) parts.push({ type: "image_url", image_url: { url: `data:${f.mime};base64,${f.data.toString("base64")}` } });
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "DE-app" },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [{ role: "user", content: parts }],
        response_format: { type: "json_schema", json_schema: ANALYSIS_SCHEMA },
        // PDFs: read natively by the model; never fall back to the paid OCR engine.
        plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
        max_tokens: 6000,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.error("analyseDocument: OpenRouter", res.status, (await res.text()).slice(0, 300));
      return { error: "ai" };
    }
    const content = (await res.json())?.choices?.[0]?.message?.content;
    const analysis = typeof content === "string" ? parseAnalysis(JSON.parse(content), KNOWN) : null;
    if (!analysis) console.error("analyseDocument: unexpected answer");
    return analysis ? { analysis } : { error: "ai" };
  } catch (err) {
    console.error("analyseDocument failed:", err instanceof Error ? err.message : err);
    return { error: "ai" };
  }
}
```

- [ ] **Step 6: Live check** (scratchpad script, ~$0.002, run with `node --env-file=.env.local`; it may import `lib/learning/suggestions.ts` but not `analyse.ts`, which is server-only — copy the request shape): send (a) the sample text as `.docx` text, (b) a generated one-page PDF of the same text, (c) the HEIC photo from earlier testing, (d) a **blank white PNG**. Expected: (a)–(c) suggest `prepositions-dative` (and/or `dative-case`) with reasons quoting "mit dem Bus"; (d) `noGrammar: true`, empty `extractedText`, no topics. If (d) invents text, strengthen the prompt and re-check.
- [ ] **Step 7: Commit** — `git commit -m "Add Word reader and AI document analysis"`

---

### Task 6: Server actions (`app/learning/actions.ts`)

**Files:** Create `app/learning/actions.ts`

**Interfaces:**
- Consumes: `ownedPaths`, `BUCKET`, `MAX_FILE_BYTES`, `MAX_PDF_PAGES`, `mimeFor` (Task 1); `extractDocxText`, `analyseDocument` (Task 5); `getTopic` (catalogue).
- Produces: `analyseUpload(paths: unknown): Promise<{ id: number } | { error: string }>`, `deleteDocument(id: unknown): Promise<{ error?: string }>`, `setFocus(slug: unknown, kind: unknown): Promise<{ error?: string }>`.

- [ ] **Step 1: Implement:**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getTopic } from "@/lib/grammar/topics";
import { analyseDocument } from "@/lib/learning/analyse";
import { extractDocxText } from "@/lib/learning/docx";
import { BUCKET, MAX_FILE_BYTES, MAX_PDF_PAGES, mimeFor, ownedPaths, type UploadKind } from "@/lib/learning/uploads";
import { createClient } from "@/lib/supabase/server";

const ERRORS = {
  loggedOut: "Please log in again.",
  files: "Something was wrong with the upload. Please try again.",
  limit: "You've reached today's upload limit (10 a day). Please try again tomorrow.",
  docLimit: "You've reached the limit of 200 saved documents. Delete some to upload new ones.",
  pdfPages: "This PDF has more than 20 pages. Please upload a shorter part.",
  docx: "Couldn't read this Word file. Save it as PDF and upload that.",
  ai: "Couldn't read this document right now. Nothing was saved — please try again.",
  generic: "Something went wrong — please try again.",
};

/** Reads the uploaded files with AI, saves the result, and always deletes the files. */
export async function analyseUpload(paths: unknown): Promise<{ id: number } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: ERRORS.loggedOut };
  const owned = ownedPaths(paths, userId);
  if (!owned) return { error: ERRORS.files };
  const storage = supabase.storage.from(BUCKET);

  try {
    const { error: quotaError } = await supabase.rpc("use_upload_quota");
    if (quotaError) return { error: quotaError.code === "P0001" ? ERRORS.limit : ERRORS.generic };

    const files = [];
    for (const path of owned) {
      const { data: blob, error } = await storage.download(path);
      const mime = mimeFor({ name: path, size: 0, type: "" });
      if (error || !blob || !mime || blob.size > MAX_FILE_BYTES) return { error: ERRORS.files };
      files.push({ name: path.split("/").pop()!, mime, data: Buffer.from(await blob.arrayBuffer()) });
    }
    const kind: UploadKind = files[0].mime === "application/pdf" ? "pdf" : files[0].mime.includes("wordprocessingml") ? "docx" : "images";
    if (kind !== "images" && files.length > 1) return { error: ERRORS.files };
    if (kind === "pdf" && (files[0].data.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0) > MAX_PDF_PAGES) {
      return { error: ERRORS.pdfPages };
    }
    const docxText = kind === "docx" ? extractDocxText(files[0].data) ?? undefined : undefined;
    if (kind === "docx" && !docxText) return { error: ERRORS.docx };

    const result = await analyseDocument({ kind, files, docxText });
    if ("error" in result) return { error: result.error === "unreadable" ? ERRORS.docx : ERRORS.ai };
    const a = result.analysis;
    const { data: row, error } = await supabase
      .from("learning_documents")
      .insert({ title: a.title, extracted_text: a.extractedText, no_grammar: a.noGrammar, suggestions: a.topics })
      .select("id")
      .single();
    if (error || !row) {
      console.error("saving learning document failed:", error?.message);
      return { error: error?.code === "P0001" ? ERRORS.docLimit : ERRORS.generic };
    }
    revalidatePath("/learning");
    return { id: row.id };
  } finally {
    // The original files are never kept, whatever happened above.
    const { error } = await storage.remove(owned);
    if (error) console.error("deleting uploaded files failed:", error.message);
  }
}

export async function deleteDocument(id: unknown): Promise<{ error?: string }> {
  if (!Number.isSafeInteger(id) || (id as number) <= 0) return { error: ERRORS.generic };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: ERRORS.loggedOut };
  const { error } = await supabase.from("learning_documents").delete().eq("id", id as number);
  if (error) return { error: ERRORS.generic };
  revalidatePath("/learning");
  return {};
}

/** Adds a topic to the focus by hand, or removes it. */
export async function setFocus(slug: unknown, kind: unknown): Promise<{ error?: string }> {
  if (typeof slug !== "string" || !getTopic(slug) || (kind !== "added" && kind !== "removed")) return { error: ERRORS.generic };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: ERRORS.loggedOut };
  const { error } = await supabase
    .from("learning_focus")
    .upsert({ topic_slug: slug, kind, updated_at: new Date().toISOString() }, { onConflict: "user_id,topic_slug" });
  if (error) {
    console.error("setFocus failed:", error.message);
    return { error: ERRORS.generic };
  }
  revalidatePath("/learning");
  revalidatePath(`/topics/${slug}`);
  return {};
}
```

- [ ] **Step 2: Check** — `npx tsc --noEmit && npm run lint` → clean. (Upsert relies on `user_id` defaulting to `auth.uid()`; if PostgREST requires the conflict column in the payload, add `user_id: userId` and grant insert on `user_id` — the RLS `with check` still pins it to the caller.)
- [ ] **Step 3: Commit** — `git commit -m "Add server actions for uploads, documents and focus"`

---

### Task 7: The Customized Learning page and components

**Files:** Create `app/learning/page.tsx`, `components/learning/UploadBox.tsx`, `components/learning/FocusList.tsx`, `components/learning/DocumentList.tsx`, `components/learning/FocusButton.tsx`; modify `app/topics/[slug]/page.tsx`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: the `/learning` route; `<FocusButton slug inFocus />` on topic pages.

**Layout** (desktop two columns, phone stacked: upload first):

```
┌──────────────────────────────────────────────────────────────┐
│ Customized Learning                                           │
│ Upload what you're learning; get the grammar topics to practise│
├───────────────────────────────┬──────────────────────────────┤
│ UPLOAD (card, yellow shadow)  │ YOUR FOCUS NOW               │
│ [Choose PDF, Word or photos]  │ ● Dative case  A2  [mistake] │
│ note: printed/typed only …    │   12 answers · 75% · 2d ago  │
│ status: Reading your document…│   since 3 Oct · "Lektion 7"  │
│                               │   [Practise] [Remove]        │
├───────────────────────────────┴──────────────────────────────┤
│ YOUR DOCUMENTS (newest first)                                 │
│ Textbook p. 34: dative prepositions · 9 Oct                   │
│   Dative prepositions A2 — "mit dem Bus" …  [topic links]     │
│   ▸ What I read      [Delete]                                 │
└──────────────────────────────────────────────────────────────┘
```

Empty state (no documents, no focus): the upload card plus "How it works: 1 Upload what you're learning · 2 We read it · 3 You get topics to practise, with links", and links to Grammar Topics and the der·die·das flashcards. Guests: the page heading, a short description and "Log in to use Customized Learning" / "Sign up" buttons.

- [ ] **Step 1: `components/learning/UploadBox.tsx`** (client):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { analyseUpload } from "@/app/learning/actions";
import { createClient } from "@/lib/supabase/client";
import { BUCKET, UPLOAD_NOTE, mimeFor, storagePath, validateSelection } from "@/lib/learning/uploads";

const ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function UploadBox({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error" | "done"; text: string }>({ kind: "idle", text: "" });

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    const check = validateSelection(files.map((f) => ({ name: f.name, size: f.size, type: f.type })));
    if ("error" in check) return setStatus({ kind: "error", text: check.error });

    setStatus({ kind: "busy", text: "Uploading…" });
    const storage = createClient().storage.from(BUCKET);
    const batch = crypto.randomUUID();
    const paths: string[] = [];
    for (const [i, file] of files.entries()) {
      const path = storagePath(userId, batch, i, file.name);
      const { error } = await storage.upload(path, file, { contentType: mimeFor(file) ?? undefined });
      if (error) {
        if (paths.length) await storage.remove(paths);
        return setStatus({ kind: "error", text: "The upload didn't work. Please try again." });
      }
      paths.push(path);
    }
    setStatus({ kind: "busy", text: "Reading your document… this takes up to a minute." });
    const result = await analyseUpload(paths).catch(() => ({ error: "Something went wrong — please try again." }));
    if ("error" in result) return setStatus({ kind: "error", text: result.error });
    setStatus({ kind: "done", text: "Done! Your topics are below." });
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[8px_8px_0_var(--accent)] sm:p-6" aria-labelledby="upload-title">
      <h2 id="upload-title" className="text-lg font-semibold tracking-[-0.02em]">Upload what you&apos;re learning</h2>
      <label className="flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-[var(--line)] px-4 py-8 text-center text-sm hover:border-zinc-900 dark:hover:border-zinc-100">
        <span className="font-semibold">Choose a PDF, a Word file or up to 5 photos</span>
        <span className="text-zinc-500">PDF, DOCX, JPG, PNG, WebP or HEIC · up to 10 MB each</span>
        <input id="learning-upload" type="file" accept={ACCEPT} multiple className="sr-only" disabled={status.kind === "busy"} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      <p className="text-xs leading-5 text-zinc-500">{UPLOAD_NOTE}</p>
      {status.text && (
        <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm ${status.kind === "error" ? "text-red-600 dark:text-red-400" : status.kind === "done" ? "text-green-700 dark:text-green-400" : ""}`}>
          {status.text}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: `components/learning/FocusList.tsx`** (client) — renders `FocusItem[]` joined with catalogue topics and progress:

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setFocus } from "@/app/learning/actions";
import { LevelBadge } from "@/components/LevelBadge";
import type { GrammarTopic } from "@/lib/grammar/topics";
import type { FocusItem } from "@/lib/learning/focus";
import type { TopicProgress } from "@/lib/learning/progress";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function FocusList({ items, topics, progress }: { items: FocusItem[]; topics: Record<string, GrammarTopic>; progress: Record<string, TopicProgress> }) {
  const [pending, start] = useTransition();
  if (items.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing in focus yet. Upload a document, or add topics from <Link href="/topics" className="underline underline-offset-2">Grammar Topics</Link>.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const topic = topics[item.slug];
        const p = progress[item.slug];
        if (!topic) return null;
        return (
          <li key={item.slug} className="flex flex-col gap-1.5 border border-[var(--line)] bg-[var(--paper)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={topic.level} />
              <Link href={`/topics/${topic.slug}`} className="font-semibold hover:underline">{topic.title}</Link>
              {item.mistakes > 0 && <span className="rounded-full bg-red-600/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">mistakes seen</span>}
            </div>
            <p className="text-xs text-zinc-500">
              {topic.exercises?.length
                ? p ? `${p.total} answers · ${Math.round((p.correct / p.total) * 100)}% correct · last practised ${date(p.lastPractised!)}` : "Not practised yet"
                : "No exercises yet"}
            </p>
            <p className="text-xs text-zinc-500">
              In focus since {date(item.since)}{item.fromTitle ? ` · from “${item.fromTitle}”` : " · added by you"}{item.documents > 1 ? ` · in ${item.documents} documents` : ""}
            </p>
            <div className="flex gap-3 text-sm">
              {topic.exercises?.[0] && <Link href={topic.exercises[0].href} className="font-semibold underline underline-offset-2">Practise</Link>}
              <button type="button" disabled={pending} className="text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => start(async () => { await setFocus(item.slug, "removed"); })}>
                Remove from focus
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: `components/learning/DocumentList.tsx`** (client):

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteDocument } from "@/app/learning/actions";
import { LevelBadge } from "@/components/LevelBadge";
import type { GrammarTopic } from "@/lib/grammar/topics";
import type { Suggestion } from "@/lib/learning/suggestions";

type Doc = { id: number; title: string; created_at: string; extracted_text: string; no_grammar: boolean; suggestions: Suggestion[] };
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function DocumentList({ docs, topics }: { docs: Doc[]; topics: Record<string, GrammarTopic> }) {
  return (
    <ul className="flex flex-col gap-3">
      {docs.map((d) => <DocumentItem key={d.id} doc={d} topics={topics} />)}
    </ul>
  );
}

function DocumentItem({ doc, topics }: { doc: Doc; topics: Record<string, GrammarTopic> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{doc.title}</h3>
        <span className="text-xs text-zinc-500">{date(doc.created_at)}</span>
      </div>
      {doc.no_grammar ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No German grammar topics found in this document.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {doc.suggestions.map((s) => topics[s.slug] && (
            <li key={s.slug} className="flex flex-wrap items-center gap-2 text-sm">
              <LevelBadge level={topics[s.slug].level} />
              <Link href={`/topics/${s.slug}`} className="font-medium underline underline-offset-2">{topics[s.slug].title}</Link>
              {s.fromMistake && <span className="text-xs font-semibold text-red-700 dark:text-red-400">mistake</span>}
              <span className="w-full text-zinc-600 dark:text-zinc-400">{s.reason}</span>
            </li>
          ))}
        </ul>
      )}
      {doc.extracted_text && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-500">What I read</summary>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{doc.extracted_text}</p>
        </details>
      )}
      <div className="flex gap-3 text-sm">
        {confirming ? (
          <>
            <button type="button" disabled={pending} className="font-semibold text-red-700 underline underline-offset-2 dark:text-red-400"
              onClick={() => start(async () => { const r = await deleteDocument(doc.id); if (r.error) { setError(r.error); setConfirming(false); } })}>
              Yes, delete it
            </button>
            <button type="button" className="underline underline-offset-2" onClick={() => setConfirming(false)}>Keep it</button>
          </>
        ) : (
          <button type="button" className="text-zinc-500 underline underline-offset-2" onClick={() => setConfirming(true)}>Delete</button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}
```

- [ ] **Step 4: `components/learning/FocusButton.tsx`** (client):

```tsx
"use client";

import { useState, useTransition } from "react";
import { setFocus } from "@/app/learning/actions";

export function FocusButton({ slug, inFocus }: { slug: string; inFocus: boolean }) {
  const [on, setOn] = useState(inFocus);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toggle = () => start(async () => {
    const r = await setFocus(slug, on ? "removed" : "added");
    if (r.error) setError(r.error); else { setOn(!on); setError(""); }
  });
  return (
    <p className="text-sm">
      {on && <span className="mr-2 font-semibold">In your focus ·</span>}
      <button type="button" disabled={pending} onClick={toggle} className="underline underline-offset-2">
        {on ? "Remove" : "Add to my focus"}
      </button>
      {error && <span role="alert" className="ml-2 text-red-600 dark:text-red-400">{error}</span>}
    </p>
  );
}
```

- [ ] **Step 5: `app/learning/page.tsx`** (server):

```tsx
import Link from "next/link";
import { DocumentList } from "@/components/learning/DocumentList";
import { FocusList } from "@/components/learning/FocusList";
import { UploadBox } from "@/components/learning/UploadBox";
import { TOPICS } from "@/lib/grammar/topics";
import { buildFocus, type FocusOverride } from "@/lib/learning/focus";
import { topicProgress } from "@/lib/learning/progress";
import type { Suggestion } from "@/lib/learning/suggestions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Customized Learning" };
const TOPIC_MAP = Object.fromEntries(TOPICS.map((t) => [t.slug, t]));
const heading = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";
const pillPrimary = "inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

export default async function LearningPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const intro = (
    <div>
      <div className="mb-4 h-2 w-12 bg-[var(--accent)]" />
      <h1 className="text-3xl font-bold leading-none tracking-[-0.06em] sm:text-4xl">Customized Learning</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Upload what you&apos;re learning in class or on your own, and get the grammar topics to practise, with your progress on each.
      </p>
    </div>
  );
  if (!userId) {
    return (
      <div className="flex flex-col gap-6">
        {intro}
        <div className="flex flex-wrap gap-3">
          <Link href="/login?next=/learning" className={pillPrimary}>Log in to use Customized Learning</Link>
          <Link href="/auth/sign-up" className="inline-flex items-center rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium">Sign up</Link>
        </div>
      </div>
    );
  }

  const [{ data: docs }, { data: overrides }, { data: attempts }] = await Promise.all([
    supabase.from("learning_documents").select("id, title, created_at, extracted_text, no_grammar, suggestions").order("created_at", { ascending: false }).limit(200),
    supabase.from("learning_focus").select("topic_slug, kind, updated_at"),
    supabase.from("attempts").select("topic, correct, created_at").limit(10000),
  ]);
  const focus = buildFocus(
    (docs ?? []).map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at, topics: d.suggestions as Suggestion[] })),
    (overrides ?? []).map((o) => ({ slug: o.topic_slug, kind: o.kind, updatedAt: o.updated_at }) as FocusOverride),
    new Date(),
  );
  const progress = topicProgress(attempts ?? []);
  const isEmpty = !docs?.length && focus.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {intro}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <UploadBox userId={userId} />
        <section className="flex flex-col gap-3" aria-labelledby="focus-title">
          <h2 id="focus-title" className={heading}>Your focus now</h2>
          {isEmpty ? (
            <ol className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><b>1.</b> Upload a textbook page, worksheet, notes or homework.</li>
              <li><b>2.</b> We read it and pick the grammar topics it covers, and any mistakes.</li>
              <li><b>3.</b> Practise those topics and watch your progress here.</li>
              <li className="pt-2">Or start now: <Link href="/topics" className="underline underline-offset-2">Grammar Topics</Link> · <Link href="/articles" className="underline underline-offset-2">der · die · das</Link></li>
            </ol>
          ) : (
            <FocusList items={focus} topics={TOPIC_MAP} progress={progress} />
          )}
        </section>
      </div>
      {!!docs?.length && (
        <section className="flex flex-col gap-3" aria-labelledby="docs-title">
          <h2 id="docs-title" className={heading}>Your documents ({docs.length})</h2>
          <DocumentList docs={docs.map((d) => ({ ...d, suggestions: d.suggestions as Suggestion[] }))} topics={TOPIC_MAP} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Topic page** — in `app/topics/[slug]/page.tsx`, add after the `articles` line:

```tsx
const supabase = await createClient();
const { data: claims } = await supabase.auth.getClaims();
const loggedIn = !!claims?.claims;
const inFocus = loggedIn && await isInFocus(supabase, topic.slug);
```

with this helper in the same file (a topic counts as "in focus" if added by hand; topics only suggested by uploads show "Add" — adding just pins them):

```tsx
async function isInFocus(supabase: Awaited<ReturnType<typeof createClient>>, slug: string) {
  const { data } = await supabase.from("learning_focus").select("kind").eq("topic_slug", slug).maybeSingle();
  return data?.kind === "added";
}
```

and render `{loggedIn && <FocusButton slug={topic.slug} inFocus={inFocus} />}` as the last child of the Practise section. Imports: `createClient` from `@/lib/supabase/server`, `FocusButton` from `@/components/learning/FocusButton`. The page becomes dynamic (reads cookies); `generateStaticParams` still limits it to catalogue slugs.

- [ ] **Step 7: Check** — `npm test && npx tsc --noEmit && npm run lint && npm run build` → clean; `/learning` in the route list.
- [ ] **Step 8: Commit** — `git commit -m "Add the Customized Learning page"`

---

### Task 8: Make it the centre (landing, nav, guest front page, email link)

**Files:** Modify `lib/safe-redirect.ts`, `lib/safe-redirect.test.mjs`, `app/page.tsx`, `components/NavBar.tsx`, `supabase/templates/confirmation.html`

- [ ] **Step 1: Failing test** — in `lib/safe-redirect.test.mjs`, change the default-fallback expectations from `"/articles"` to `"/learning"` (e.g. `assert.equal(safeRedirectPath(null), "/learning")`). Run → FAIL.
- [ ] **Step 2: Implement** — `export function safeRedirectPath(raw, fallback = "/learning")`. Run → PASS. (This covers email/password login, Google sign-in and the confirmation link, which all use it.)
- [ ] **Step 3: Front page** — in `app/page.tsx`: logged in (`getClaims`) → `redirect("/learning")` (unless `?account=deleted`, which only happens signed out). Guests: lead with Customized Learning ("Upload what you're learning and get grammar topics to practise", Sign up / Log in buttons), then "Try it without an account": Grammar Topics and der·die·das cards. Keep the account-deleted notice.
- [ ] **Step 4: Nav** — `LINKS = [{ href: "/learning", label: "Customized Learning", also: [] }, { href: "/topics", label: "Grammar Topics", also: ["/articles", "/rules"] }]`.
- [ ] **Step 5: Confirmation email** — change `next=/articles` to `next=/learning` in `supabase/templates/confirmation.html`; `npx supabase config diff --project-ref …` should show only the template; **ask the user** before `echo y | npx supabase config push --project-ref …`.
- [ ] **Step 6: Check + commit** — `npm test && npx tsc --noEmit && npm run lint && npm run build`; `git commit -m "Make Customized Learning the landing page"`

---

### Task 9: Privacy page and docs

- [ ] **Step 1:** `app/privacy/page.tsx` — "What we store": *Your Customized Learning documents: the title, the text read from each document and the suggested topics; the original files are deleted straight after reading. Your focus list.* "Services": *OpenRouter and Google: when you upload a document, it's sent through OpenRouter to Google's Gemini model to read it and suggest topics. Don't upload documents with personal details.* "Deleting": *…your documents and focus list.*
- [ ] **Step 2:** `docs/supabase-schema.md` (if not done in Task 4) and `.env.example` comment (`OPENROUTER_API_KEY` powers Customized Learning).
- [ ] **Step 3: Commit** — `git commit -m "Update privacy page and docs for Customized Learning"`

---

### Task 10: Browser checks, security scan, ship

**Files:** Create `e2e/lib.sh` (login/logout/eval helpers as in the removed RAG checks, accounts from `E2E_MAIN_*` / `E2E_OTHER_*`), `e2e/learning.sh`, `e2e/fixtures/` (`lektion7.pdf` generated from the sample text, `lektion7.heic`, `lektion7.docx`, `blank.png`), `e2e/README.md`

- [ ] **Step 1:** `e2e/learning.sh` checks (each prints ✅/❌, ends with `RESULT: PASS|FAIL`), using `playwright-cli upload`:
  1. Guest `/learning` shows "Log in to use Customized Learning"; logging in from `/login` lands on `/learning`; `/` redirects there when logged in.
  2. Upload the PDF → a document titled with "Lektion 7"/"Präpositionen" appears, with `prepositions-dative` or `dative-case` among its topics, and "Your focus now" lists it.
  3. Upload the HEIC photo and the Word file → same topics.
  4. Upload `blank.png` → "No German grammar topics found", no topics.
  5. After each upload, the user's storage folder is empty (SQL: `select count(*) from storage.objects where bucket_id = 'learning-uploads'`).
  6. "Remove from focus" hides the topic; "Add to my focus" on `/topics/modal-verbs` adds it.
  7. Delete a document → gone after reload.
  8. User B (`E2E_OTHER`) sees none of user A's documents or focus.
  9. Unsupported file (`.doc`) and 6 photos show the plain error messages without uploading.
  Clean up: delete created documents and focus rows through the page.
- [ ] **Step 2:** Run `npm test`, `npm run build`, and `bash e2e/learning.sh` against `npm run dev` → all pass.
- [ ] **Step 3:** Run `/security-scan-changed` and fix confirmed findings (test-first).
- [ ] **Step 4:** With the user's OK: merge into `main`, push, re-run `e2e/learning.sh` with `BASE=https://de-app-six.vercel.app`, update the "How DE-app works" explainer.
