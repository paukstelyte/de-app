// Notes for the chat's RAG: validation, chunking and checking embeddings.
// No imports, so `npm test` can load it straight into Node.

export const CHUNK_SIZE = 500; // characters per chunk, at most
export const CHUNK_OVERLAP = 100; // characters repeated from the end of the previous chunk
export const EMBEDDING_DIMENSIONS = 1536; // openai/text-embedding-3-small; must match vector(1536)
export const MAX_TITLE = 200;
export const MAX_CONTENT = 20000;

export type Note = { id: number; title: string; content: string; chunks: number };

/** Trimmed title and content, or null if either is missing or too long. */
export function validateNote(title: unknown, content: unknown): { title: string; content: string } | null {
  if (typeof title !== "string" || typeof content !== "string") return null;
  const t = title.trim();
  const c = content.trim();
  if (!t || !c || t.length > MAX_TITLE || c.length > MAX_CONTENT) return null;
  return { title: t, content: c };
}

/** Splits text into chunks of at most `size` characters that overlap by about
 * `overlap` characters, so a sentence on a boundary is whole in at least one
 * chunk. A chunk ends at a sentence end if there's one in its second half,
 * otherwise at a space; text with no spaces is cut hard. */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const earliest = Math.floor(size / 2); // don't make chunks tiny just to hit a boundary
      const sentenceEnd = Math.max(...[". ", "! ", "? ", "\n"].map((m) => window.lastIndexOf(m)));
      const space = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\n"));
      if (sentenceEnd >= earliest) end = start + sentenceEnd + 1;
      else if (space >= earliest) end = start + space;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;

    // Step back by the overlap, then forward to the start of a word.
    let next = end - overlap;
    if (next > 0 && !/\s/.test(clean[next - 1])) {
      const gap = clean.slice(next, end).search(/\s/);
      if (gap !== -1) next += gap + 1;
    }
    start = Math.max(next, start + 1);
  }
  return chunks;
}

/** The vectors from an OpenRouter embeddings response, in input order, or null
 * unless there is exactly one 1536-number vector per input. */
export function embeddingsFrom(data: unknown, expected: number): number[][] | null {
  const list = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(list) || list.length !== expected) return null;
  const sorted = [...(list as { index?: unknown; embedding?: unknown }[])].sort(
    (a, b) => Number(a.index) - Number(b.index),
  );
  const vectors = sorted.map((d) => d.embedding);
  const ok = vectors.every(
    (v) => Array.isArray(v) && v.length === EMBEDDING_DIMENSIONS && v.every((x) => typeof x === "number" && Number.isFinite(x)),
  );
  return ok ? (vectors as number[][]) : null;
}
