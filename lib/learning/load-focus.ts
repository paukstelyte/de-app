import "server-only"; // reads the user's documents and focus; the build fails if browser code imports this
import { buildFocus, type FocusOverride } from "@/lib/learning/focus";
import type { Suggestion } from "@/lib/learning/suggestions";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Typed as plain strings so both column lists share one query shape.
const FULL: string = "id, title, created_at, extracted_text, no_grammar, suggestions, model, prompt_tokens, completion_tokens, cost_usd";
const LIGHT: string = "id, title, created_at, suggestions";

/** The logged-in user's "Your focus now" list (RLS scopes it to them). With `withDocuments`, also returns
 * the documents in full for the document list; otherwise only the columns the focus needs are read. */
export async function loadFocus(supabase: Supabase, { withDocuments = false } = {}) {
  const [{ data: docs }, { data: overrides }] = await Promise.all([
    supabase
      .from("learning_documents")
      .select(withDocuments ? FULL : LIGHT)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("learning_focus").select("topic_slug, kind, updated_at"),
  ]);
  // The document-list fields are only filled in when withDocuments is set.
  type Row = {
    id: number; title: string; created_at: string; suggestions: unknown;
    extracted_text: string; no_grammar: boolean; model: string | null; prompt_tokens: number | null; completion_tokens: number | null; cost_usd: number | string | null;
  };
  const documents = ((docs ?? []) as unknown as Row[]).map((d) => ({ ...d, suggestions: d.suggestions as Suggestion[] }));
  const focus = buildFocus(
    documents.map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at, topics: d.suggestions })),
    (overrides ?? []).map((o) => ({ slug: o.topic_slug, kind: o.kind, updatedAt: o.updated_at }) as FocusOverride),
    new Date(),
  );
  return { documents, focus };
}
