import "server-only"; // reads the user's documents and focus; the build fails if browser code imports this
import { buildFocus } from "@/lib/learning/focus";
import { SavedSuggestions } from "@/lib/learning/suggestions";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
const suggestionsOf = (json: unknown) => SavedSuggestions.catch([]).parse(json);

async function readOverrides(supabase: Supabase) {
  return supabase.from("learning_focus").select("topic_slug, kind, updated_at");
}

function focusFrom(
  docs: { id: number; title: string; created_at: string; suggestions: unknown }[],
  overrides: { topic_slug: string; kind: string; updated_at: string }[],
) {
  return buildFocus(
    docs.map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at, topics: suggestionsOf(d.suggestions) })),
    overrides.flatMap((o) => (o.kind === "added" || o.kind === "removed" ? [{ slug: o.topic_slug, kind: o.kind, updatedAt: o.updated_at }] : [])),
    new Date(),
  );
}

// A failed read returns { ok: false }, never an empty list, so the page can offer a retry
// instead of a misleading "nothing here yet".

/** The logged-in user's "Your focus now" list (RLS scopes it to them), reading only the columns it needs. */
export async function loadFocus(supabase: Supabase) {
  const [docs, overrides] = await Promise.all([
    supabase.from("learning_documents").select("id, title, created_at, suggestions").order("created_at", { ascending: false }).limit(200),
    readOverrides(supabase),
  ]);
  if (docs.error || overrides.error) {
    console.error("loadFocus failed:", docs.error?.message ?? overrides.error?.message);
    return { ok: false } as const;
  }
  return { ok: true, focus: focusFrom(docs.data, overrides.data) } as const;
}

/** The focus list plus every document in full, for the Customized Learning page. */
export async function loadDocumentsAndFocus(supabase: Supabase) {
  const [docs, overrides] = await Promise.all([
    supabase
      .from("learning_documents")
      .select("id, title, created_at, extracted_text, no_grammar, suggestions, model, prompt_tokens, completion_tokens, cost_usd")
      .order("created_at", { ascending: false })
      .limit(200),
    readOverrides(supabase),
  ]);
  if (docs.error || overrides.error) {
    console.error("loadDocumentsAndFocus failed:", docs.error?.message ?? overrides.error?.message);
    return { ok: false } as const;
  }
  const documents = docs.data.map((d) => ({ ...d, suggestions: suggestionsOf(d.suggestions) }));
  return { ok: true, documents, focus: focusFrom(docs.data, overrides.data) } as const;
}

export type LearningDocument = Extract<Awaited<ReturnType<typeof loadDocumentsAndFocus>>, { ok: true }>["documents"][number];
