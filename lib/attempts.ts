import "server-only"; // reads the user's answers; the build fails if browser code imports this
import { createClient } from "@/lib/supabase/server";
import { loadFlashcards } from "@/lib/flashcards/storage";
import { summarize, type Attempt } from "@/lib/progress";

const PAGE = 1000; // Supabase returns at most 1000 rows per request.

/** Pages through the logged-in user's attempts (past the 1000-row cap), oldest first; RLS scopes to them.
 * ponytail: reads the whole history; move the summary into SQL if it grows to tens of thousands of rows. */
async function pageAttempts<T>(columns: string, topic?: string): Promise<T[]> {
  const supabase = await createClient();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from("attempts").select(columns);
    if (topic) q = q.eq("topic", topic);
    const { data, error } = await q.order("created_at").order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as unknown as T[]));
    if (data.length < PAGE) return rows;
  }
}

/** All of the logged-in user's answers across topics, oldest first. */
export const getAllAttempts = () =>
  pageAttempts<{ topic: string; correct: boolean; created_at: string }>("topic, correct, created_at");

const getAttempts = (topic: string) => pageAttempts<Attempt>("item_id, correct", topic);

/** Answer counts for one topic; null for guests. */
export async function getTopicAccuracy(slug: string): Promise<{ total: number; correct: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const rows = await pageAttempts<{ correct: boolean }>("correct", slug);
  return { total: rows.length, correct: rows.filter((r) => r.correct).length };
}

/** Returns null for guests. */
export async function getArticlesProgress() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return summarize(await getAttempts("articles"), loadFlashcards());
}
