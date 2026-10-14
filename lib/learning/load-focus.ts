import "server-only"; // reads the user's documents and focus; the build fails if browser code imports this
import { buildFocus } from "@/lib/learning/focus";
import { SavedSuggestions } from "@/lib/learning/suggestions";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DocRow = { id: number; title: string; created_at: string; suggestions: unknown };
type Read<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

function suggestionsOf(doc: DocRow) {
  const parsed = SavedSuggestions.safeParse(doc.suggestions);
  if (!parsed.success) console.error(`document ${doc.id}: saved suggestions don't fit the schema`, parsed.error.issues[0]?.message);
  return parsed.success ? parsed.data : [];
}

/** The documents (RLS scopes them to the user) plus "Your focus now". A failed read returns { ok: false },
 * never an empty list, so the page can offer a retry instead of a misleading "nothing here yet". */
async function withFocus<D extends DocRow>(supabase: Supabase, documents: Read<D>, what: string) {
  const [docs, overrides] = await Promise.all([documents, supabase.from("learning_focus").select("topic_slug, kind, updated_at")]);
  if (docs.error || overrides.error || !docs.data || !overrides.data) {
    console.error(`${what} failed:`, docs.error?.message ?? overrides.error?.message);
    return { ok: false } as const;
  }
  const withTopics = docs.data.map((d) => ({ ...d, suggestions: suggestionsOf(d) }));
  const focus = buildFocus(
    withTopics.map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at, topics: d.suggestions })),
    overrides.data.flatMap((o) => (o.kind === "added" || o.kind === "removed" ? [{ slug: o.topic_slug, kind: o.kind, updatedAt: o.updated_at }] : [])),
    new Date(),
  );
  return { ok: true, documents: withTopics, focus } as const;
}

const documents = (supabase: Supabase) => supabase.from("learning_documents");

/** "Your focus now", reading only the columns it needs. */
export const loadFocus = (supabase: Supabase) =>
  withFocus(supabase, documents(supabase).select("id, title, created_at, suggestions").order("created_at", { ascending: false }).limit(200), "loadFocus");

/** The focus list plus every document in full, for the Customized Learning page. */
export const loadDocumentsAndFocus = (supabase: Supabase) =>
  withFocus(
    supabase,
    documents(supabase)
      .select("id, title, created_at, extracted_text, no_grammar, suggestions, model, prompt_tokens, completion_tokens, cost_usd")
      .order("created_at", { ascending: false })
      .limit(200),
    "loadDocumentsAndFocus",
  );

export type LearningDocument = Extract<Awaited<ReturnType<typeof loadDocumentsAndFocus>>, { ok: true }>["documents"][number];
