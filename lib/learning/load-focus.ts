import { buildFocus, type FocusOverride } from "@/lib/learning/focus";
import type { Suggestion } from "@/lib/learning/suggestions";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The logged-in user's saved documents and their "Your focus now" list (RLS scopes both to them). */
export async function loadFocus(supabase: Supabase) {
  const [{ data: docs }, { data: overrides }] = await Promise.all([
    supabase
      .from("learning_documents")
      .select("id, title, created_at, extracted_text, no_grammar, suggestions, model, prompt_tokens, completion_tokens, cost_usd")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("learning_focus").select("topic_slug, kind, updated_at"),
  ]);
  const documents = (docs ?? []).map((d) => ({ ...d, suggestions: d.suggestions as Suggestion[] }));
  const focus = buildFocus(
    documents.map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at, topics: d.suggestions })),
    (overrides ?? []).map((o) => ({ slug: o.topic_slug, kind: o.kind, updatedAt: o.updated_at }) as FocusOverride),
    new Date(),
  );
  return { documents, focus };
}
