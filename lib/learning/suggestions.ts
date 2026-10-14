// The AI's answer for an uploaded document: one Zod schema gives the TypeScript
// type, the JSON schema the model must follow and the check on its answer.
// Imports only zod, so `npm test` can load it into Node.
import { z } from "zod";

export const MAX_TEXT = 8000;
const MAX_TOPICS = 6;

// z.object: the JSON schema sent to the model still forbids extra keys (additionalProperties: false),
// but an answer with one is accepted with the extra key dropped, rather than wasted.
const SuggestionSchema = z.object({
  slug: z.string().describe("A slug from the topic list, exactly as given"),
  reason: z.string().describe("One line quoting the document"),
  fromMistake: z.boolean().describe("True only if the document shows a clear correction mark on this topic"),
});

const AnswerSchema = z.object({
  title: z.string().describe("Short title for the document, max 80 characters"),
  extractedText: z.string().describe("The text read from the document, max 8000 characters; empty if none"),
  noGrammar: z.boolean().describe("True if the text contains no German grammar to practise"),
  topics: z.array(SuggestionSchema).describe("1 to 6 well-supported topics; empty if noGrammar"),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;
export type Analysis = z.infer<typeof AnswerSchema>;
/** Saved suggestions, read back from the database (a JSON column). */
export const SavedSuggestions = z.array(SuggestionSchema);

const { $schema, ...schema } = z.toJSONSchema(AnswerSchema); // the model API doesn't take $schema
void $schema;
/** OpenRouter structured output: the model must answer in exactly this shape. */
export const ANALYSIS_SCHEMA = { name: "document_analysis", strict: true, schema } as const;

const clip = (s: string, n: number) => s.trim().slice(0, n);

/**
 * What a model answer means:
 * - an Analysis with topics: the grammar it practises (catalogue topics only, no duplicates, mistakes first, at most 6);
 * - an Analysis with `noGrammar`: readable text, but nothing to practise;
 * - "unreadable": no text could be read (blank or blurred photo, empty scan);
 * - "invalid": the answer doesn't fit the schema, or names topics but none from the catalogue.
 */
export function parseAnalysis(raw: unknown, knownSlugs: Set<string>): Analysis | "unreadable" | "invalid" {
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success) return "invalid";
  const r = parsed.data;
  const extractedText = clip(r.extractedText, MAX_TEXT);
  if (!extractedText) return "unreadable";
  const title = clip(r.title, 80) || "Untitled document";
  if (r.noGrammar) return { title, extractedText, noGrammar: true, topics: [] };

  const seen = new Set<string>();
  const topics = r.topics
    .filter((x) => knownSlugs.has(x.slug) && !seen.has(x.slug) && seen.add(x.slug))
    .map((x) => ({ ...x, reason: clip(x.reason, 200) }))
    .sort((a, b) => Number(b.fromMistake) - Number(a.fromMistake))
    .slice(0, MAX_TOPICS);
  // The model said there is grammar but named nothing usable: a bad answer, not "no grammar".
  if (topics.length === 0) return "invalid";
  return { title, extractedText, noGrammar: false, topics };
}
