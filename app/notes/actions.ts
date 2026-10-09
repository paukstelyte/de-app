"use server";

import { revalidatePath } from "next/cache";
import { embed } from "@/lib/embeddings";
import { chunkText, MAX_CONTENT, MAX_TITLE, noteLimitError, validateNote } from "@/lib/notes";
import { createClient } from "@/lib/supabase/server";

export type NoteResult = { error?: string };

const ERRORS = {
  invalid: `Give the note a title (up to ${MAX_TITLE} characters) and some text (up to ${MAX_CONTENT.toLocaleString("en")}).`,
  notFound: "That note doesn't exist any more.",
  loggedOut: "Please log in again.",
  embed: "Couldn't prepare the note for the chat right now. Nothing was saved — please try again.",
  generic: "Something went wrong — please try again.",
};

function noteIdFrom(value: unknown): number | null | undefined {
  if (value === null) return null; // new note
  return Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : undefined;
}

/** Saves a new note (noteId null) or edits one. The note is split into chunks
 * and every chunk is embedded here on the server first; only then are the note
 * and its chunks written in one step (save_note_with_chunks), replacing all old
 * chunks on an edit. Embeddings never reach the browser. */
export async function saveNote(noteId: unknown, title: unknown, content: unknown): Promise<NoteResult> {
  const note = validateNote(title, content);
  const id = noteIdFrom(noteId);
  if (!note) return { error: ERRORS.invalid };
  if (id === undefined) return { error: ERRORS.notFound };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: ERRORS.loggedOut };

  // Cheap checks before the paid embedding call. Editing: the note must be the
  // user's own (RLS hides anyone else's, so it simply isn't found).
  if (id !== null) {
    const { data: existing } = await supabase.from("notes").select("id").eq("id", id).maybeSingle();
    if (!existing) return { error: ERRORS.notFound };
  }
  // Every save counts against a per-user limit (10 a minute, 50 a day).
  const { error: quotaError } = await supabase.rpc("use_note_quota");
  if (quotaError) {
    const limit = noteLimitError(quotaError.code, quotaError.message);
    if (!limit) console.error("use_note_quota failed:", quotaError.message);
    return { error: limit ?? ERRORS.generic };
  }

  const chunks = chunkText(note.content);
  const vectors = await embed(chunks);
  if (!vectors) return { error: ERRORS.embed };

  const { error } = await supabase.rpc("save_note_with_chunks", {
    p_note_id: id,
    p_title: note.title,
    p_content: note.content,
    p_chunks: chunks,
    p_embeddings: vectors.map((v) => JSON.stringify(v)),
  });
  if (error) {
    const limit = noteLimitError(error.code, error.message);
    if (limit) return { error: limit };
    console.error("save_note_with_chunks failed:", error.code, error.message);
    return { error: error.code === "P0002" ? ERRORS.notFound : ERRORS.generic };
  }
  revalidatePath("/notes");
  return {};
}

/** Deletes one of the user's notes; its chunks go with it (foreign key cascade). */
export async function deleteNote(noteId: unknown): Promise<NoteResult> {
  const id = noteIdFrom(noteId);
  if (!id) return { error: ERRORS.notFound };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: ERRORS.loggedOut };

  // RLS limits this to the user's own notes; someone else's id deletes nothing.
  const { error, count } = await supabase.from("notes").delete({ count: "exact" }).eq("id", id);
  if (error) {
    console.error("deleteNote failed:", error.message);
    return { error: ERRORS.generic };
  }
  if (count === 0) return { error: ERRORS.notFound };
  revalidatePath("/notes");
  return {};
}
