// RAG for the chat: what to search the learner's notes for, and how the
// matching chunks are handed to the tutor. No runtime imports, so `npm test`
// can load it straight into Node.
import type { ChatMessage } from "./chat";

/** How many note chunks the tutor gets per message. */
export const MATCH_COUNT = 5;
/** Minimum similarity (−1…1) for a chunk to count as relevant. Measured with
 * openai/text-embedding-3-small: the right note scored 0.47–0.63, unrelated or
 * merely same-topic notes at most 0.34. */
export const MATCH_THRESHOLD = 0.4;

export type Match = { note_id: number; content: string; similarity: number };

/** The text to search the notes with: the learner's latest message, plus their
 * previous one so a follow-up ("say that again more simply") still finds the
 * notes the conversation is about. */
export function retrievalQuery(history: ChatMessage[]): string {
  return history
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join("\n");
}

/** Extra instructions for this one reply: the matching chunks under their note
 * titles (most relevant first), or what to do when nothing matched. */
export function notesContext(matches: Match[], titles: Record<number, string>): string {
  if (matches.length === 0) {
    return `No relevant notes were found in the learner's own notes for this message.
Start your reply with this plain sentence: "I couldn't find this in your notes." (translate it if you reply in German), with no joke or wordplay in that sentence.
Then give a short answer in your usual voice and say clearly that it is general knowledge, not from their notes.`;
  }
  const chunks = [...matches]
    .sort((a, b) => b.similarity - a.similarity)
    .map((m) => `[From the note "${titles[m.note_id] ?? "Untitled note"}"]\n${m.content}`)
    .join("\n\n");
  return `The learner's own notes contain these passages relevant to their message (most relevant first).
Answer from them. When you use a note, say so by its title, for example: based on your note "London event"…
Questions answered from these notes are allowed even if they are not about German.

${chunks}`;
}
