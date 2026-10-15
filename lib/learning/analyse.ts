import "server-only"; // reads OPENROUTER_API_KEY
import { TOPICS } from "@/lib/grammar/topics";
import { SYSTEM_PROMPT } from "@/lib/learning/prompt";
import { ANALYSIS_SCHEMA, parseAnalysis, type Analysis } from "@/lib/learning/suggestions";
import type { UploadKind } from "@/lib/learning/uploads";
import { readUsage, type Usage } from "@/lib/learning/usage";

// One fixed model (agreed): reads PDFs and photos itself, about $0.0004 per document.
export const ANALYSIS_MODEL = "google/gemini-2.5-flash-lite";
const KNOWN = new Set(TOPICS.map((t) => t.slug));
// The browser tests point OPENROUTER_BASE_URL at a local fake (e2e/mock-openrouter.mjs). Only an address on
// this machine is accepted, so a stray setting on a server can never send the API key anywhere else.
const testUrl = process.env.OPENROUTER_BASE_URL;
const OPENROUTER_URL = `${testUrl && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(testUrl) ? testUrl : "https://openrouter.ai/api/v1"}/chat/completions`;

export async function analyseDocument(input: {
  kind: UploadKind;
  files: { name: string; mime: string; data: Buffer }[];
  docxText?: string;
}): Promise<{ analysis: Analysis; usage: Usage } | { error: "ai" | "paid" | "invalid" | "unreadable" }> {
  // "ai": no paid answer (no key, nothing to send, network failure, error status), so the upload is given back.
  // The rest came after a paid answer, so the upload counts: "paid" (timeout or cut-off),
  // "invalid" (an answer that doesn't fit the schema or names no catalogue topic),
  // "unreadable" (the model found no text: blank or blurred photo, empty scan).
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("analyseDocument: OPENROUTER_API_KEY is not set");
    return { error: "ai" };
  }
  if (input.kind === "docx" ? !input.docxText?.trim() : input.files.length === 0) return { error: "ai" };
  // The uploaded material is untrusted: it goes in its own user message, never mixed into the instructions.
  const parts: object[] = [{ type: "text", text: "The document to analyse:" }];
  if (input.kind === "docx") {
    parts.push({ type: "text", text: input.docxText!.slice(0, 20000) });
  } else if (input.kind === "pdf") {
    const f = input.files[0];
    parts.push({ type: "file", file: { filename: f.name, file_data: `data:application/pdf;base64,${f.data.toString("base64")}` } });
  } else {
    for (const f of input.files) parts.push({ type: "image_url", image_url: { url: `data:${f.mime};base64,${f.data.toString("base64")}` } });
  }
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "DE-app" },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: parts }],
        response_format: { type: "json_schema", json_schema: ANALYSIS_SCHEMA },
        // PDFs: read natively by the model; never fall back to the paid OCR engine.
        plugins: [{ id: "file-parser", pdf: { engine: "native" } }],
        // Only providers that keep no copy of the document (zero data retention); the privacy page says so.
        provider: { zdr: true },
        max_tokens: 6000,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    console.error("analyseDocument failed:", err instanceof Error ? err.message : err);
    // A timeout may come after the model has started (and been billed); a network failure means no answer.
    return { error: err instanceof Error && err.name === "TimeoutError" ? "paid" : "ai" };
  }
  if (!res.ok) {
    // Only the status and error code: the message and metadata can quote the document.
    const body = await res.json().catch(() => null);
    console.error("analyseDocument: OpenRouter", res.status, body?.error?.code);
    return { error: "ai" };
  }
  try {
    const json = await res.json();
    const choice = json?.choices?.[0];
    const content = choice?.message?.content;
    let parsed: ReturnType<typeof parseAnalysis> = "invalid";
    try {
      if (typeof content === "string") parsed = parseAnalysis(JSON.parse(content), KNOWN);
    } catch {}
    if (parsed === "invalid") console.error("analyseDocument: unusable answer, finish_reason:", choice?.finish_reason, "error code:", json?.error?.code);
    if (typeof parsed === "string") return { error: parsed };
    // OpenRouter always includes usage (tokens, cost) in the response; no request option needed.
    return { analysis: parsed, usage: readUsage(json, ANALYSIS_MODEL) };
  } catch (err) {
    console.error("analyseDocument: reading the answer failed:", err instanceof Error ? err.message : err);
    return { error: "paid" };
  }
}
