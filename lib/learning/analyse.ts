import "server-only"; // reads OPENROUTER_API_KEY
import { TOPICS } from "@/lib/grammar/topics";
import { ANALYSIS_SCHEMA, parseAnalysis, type Analysis } from "@/lib/learning/suggestions";
import type { UploadKind } from "@/lib/learning/uploads";
import { readUsage, type Usage } from "@/lib/learning/usage";

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
}): Promise<{ analysis: Analysis; usage: Usage } | { error: "ai" | "unreadable" }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("analyseDocument: OPENROUTER_API_KEY is not set");
    return { error: "ai" };
  }
  if (input.kind !== "docx" && input.files.length === 0) return { error: "unreadable" };
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
    const json = await res.json();
    const choice = json?.choices?.[0];
    const content = choice?.message?.content;
    let analysis: Analysis | null = null;
    try {
      analysis = typeof content === "string" ? parseAnalysis(JSON.parse(content), KNOWN) : null;
    } catch {}
    if (!analysis) console.error("analyseDocument: unexpected answer, finish_reason:", choice?.finish_reason, "error:", JSON.stringify(json?.error)?.slice(0, 300));
    // OpenRouter always includes usage (tokens, cost) in the response; no request option needed.
    return analysis ? { analysis, usage: readUsage(json, ANALYSIS_MODEL) } : { error: "ai" };
  } catch (err) {
    console.error("analyseDocument failed:", err instanceof Error ? err.message : err);
    return { error: "ai" };
  }
}
