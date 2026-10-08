// Server only: reads OPENROUTER_API_KEY. Import only from server actions.
// Embeddings never reach the browser: the server creates them and writes them
// straight to the database.
import { embeddingsFrom } from "@/lib/notes";

// Fixed on purpose (CLAUDE.md): changing the model or its 1536 dimensions
// breaks retrieval unless every document is dropped and re-embedded.
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** One embedding per input text, in order, or null if OpenRouter fails or
 * returns anything other than one 1536-number vector per text. */
export async function embed(texts: string[]): Promise<number[][] | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("embed: OPENROUTER_API_KEY is not set");
    return null;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error("OpenRouter embeddings error:", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const vectors = embeddingsFrom(await res.json(), texts.length);
    if (!vectors) console.error("OpenRouter embeddings: unexpected response shape");
    return vectors;
  } catch (err) {
    console.error("OpenRouter embeddings failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
