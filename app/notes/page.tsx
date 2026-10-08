import { redirect } from "next/navigation";
import { NotesManager } from "@/components/NotesManager";
import type { Note } from "@/lib/notes";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/notes");

  // The user's notes, newest first, with how many chunks each was split into
  // (RLS returns only their rows). Embeddings are never selected here.
  const { data: rows, error } = await supabase
    .from("notes")
    .select("id, title, content, documents(count)")
    .order("created_at", { ascending: false });
  if (error) console.error("loading notes failed:", error.message);

  const notes: Note[] = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    chunks: (r.documents as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-4 h-2 w-12 bg-[var(--accent)]" />
        <h1 className="text-3xl font-bold leading-none tracking-[-0.06em] sm:text-4xl">Your notes</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Write down grammar points, word lists or anything you want to remember. When you save a
          note, it&apos;s split into small chunks and each chunk is turned into an embedding, ready for
          the chat tutors to search.
        </p>
      </div>
      <NotesManager notes={notes} />
    </div>
  );
}
