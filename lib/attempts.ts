import { createClient } from "@/lib/supabase/server";
import { loadFlashcards } from "@/lib/flashcards/storage";
import { summarize, type Attempt } from "@/lib/progress";

const PAGE = 1000; // Supabase returns at most 1000 rows per request.

/** All of the logged-in user's answers across topics (paged past the 1000-row cap), oldest first. */
export async function getAllAttempts(): Promise<{ topic: string; correct: boolean; created_at: string }[]> {
  const supabase = await createClient();
  const rows: { topic: string; correct: boolean; created_at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("attempts")
      .select("topic, correct, created_at")
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** The logged-in user's answers for a topic, oldest first (RLS scopes to them).
 * ponytail: reads the whole history; move the summary into SQL if it grows to tens of thousands of rows. */
async function getAttempts(topic: string): Promise<Attempt[]> {
  const supabase = await createClient();
  const rows: Attempt[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("attempts")
      .select("item_id, correct")
      .eq("topic", topic)
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** Returns null for guests. */
export async function getArticlesProgress() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return summarize(await getAttempts("articles"), loadFlashcards());
}
