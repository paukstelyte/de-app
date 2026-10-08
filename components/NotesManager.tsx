"use client";

import { useState, useTransition, type FormEvent } from "react";
import { deleteNote, saveNote, type NoteResult } from "@/app/notes/actions";
import { MAX_CONTENT, MAX_TITLE, type Note } from "@/lib/notes";

const pillPrimary =
  "inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const pillSecondary =
  "inline-flex items-center rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10";
const field = "w-full border border-[var(--line)] bg-transparent px-3 py-2 text-sm";
const FAILED = "Something went wrong — please try again.";

export function NotesManager({ notes }: { notes: Note[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  function run(action: () => Promise<NoteResult>, done: string, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action().catch((): NoteResult => ({ error: FAILED }));
      if (result.error) setMessage({ kind: "error", text: result.error });
      else {
        setMessage({ kind: "ok", text: done });
        after?.();
      }
    });
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    run(() => saveNote(editingId, title, content), editingId ? "Note updated." : "Note saved.", resetForm);
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setConfirmDelete(null);
    setMessage(null);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <form
        onSubmit={onSave}
        className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[8px_8px_0_var(--accent)]"
      >
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{editingId ? "Edit note" : "New note"}</h2>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Title
          <input
            id="note-title"
            className={field}
            value={title}
            maxLength={MAX_TITLE}
            required
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dative prepositions"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Note
          <textarea
            id="note-content"
            className={`${field} min-h-56 resize-y leading-6`}
            value={content}
            maxLength={MAX_CONTENT}
            required
            onChange={(e) => setContent(e.target.value)}
            placeholder="aus, bei, mit, nach, seit, von, zu always take the dative…"
          />
          <span className="text-xs font-normal tabular-nums text-zinc-500">
            {content.length.toLocaleString("en")} / {MAX_CONTENT.toLocaleString("en")} characters
          </span>
        </label>
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`text-sm ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}
          >
            {message.text}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={pillPrimary} disabled={isPending || !title.trim() || !content.trim()}>
            {isPending ? "Saving…" : editingId ? "Save changes" : "Save note"}
          </button>
          {editingId && (
            <button type="button" className={pillSecondary} disabled={isPending} onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="flex flex-col gap-3" aria-label="Your notes">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Saved notes ({notes.length})
        </h2>
        {notes.length === 0 ? (
          <p className="border border-[var(--line)] bg-[var(--paper)] p-5 text-sm text-zinc-600 dark:text-zinc-400">
            No notes yet. Write your first one on the left.
          </p>
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className={`flex flex-col gap-2 border bg-[var(--paper)] p-4 ${editingId === note.id ? "border-zinc-900 dark:border-zinc-100" : "border-[var(--line)]"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{note.title}</h3>
                <span className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                  {note.chunks} {note.chunks === 1 ? "chunk" : "chunks"}
                </span>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{note.content}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={pillSecondary} disabled={isPending} onClick={() => startEdit(note)}>
                  Edit
                </button>
                {confirmDelete === note.id ? (
                  <>
                    <button
                      type="button"
                      className={`${pillSecondary} border-red-600 text-red-600 dark:border-red-400 dark:text-red-400`}
                      disabled={isPending}
                      onClick={() =>
                        run(() => deleteNote(note.id), "Note deleted.", () => {
                          setConfirmDelete(null);
                          if (editingId === note.id) resetForm();
                        })
                      }
                    >
                      Yes, delete it
                    </button>
                    <button type="button" className={pillSecondary} onClick={() => setConfirmDelete(null)}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <button type="button" className={pillSecondary} disabled={isPending} onClick={() => setConfirmDelete(note.id)}>
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
