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
