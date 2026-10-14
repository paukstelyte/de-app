import "server-only"; // reads the user's answers; the build fails if browser code imports this
import { createClient } from "@/lib/supabase/server";
import { loadFlashcards } from "@/lib/flashcards/storage";
import { summarize, type Attempt } from "@/lib/progress";

/** What saving one answer returned. "invalid": retrying can't help; "logged-out" and "failed": it can. */
export type SaveResult = { ok: true } | { ok: false; error: "logged-out" | "invalid" | "failed" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saves one checked answer for the logged-in user. `clientId` is the id the browser gave this answer:
 * a retry sends the same id, and the database's unique index makes sure it is counted once. */
export async function saveAttempt(
  row: { topic: string; item_id: string; answer: string; correct: boolean },
  clientId: unknown,
): Promise<SaveResult> {
  if (typeof clientId !== "string" || !UUID.test(clientId)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "logged-out" };
  const { error } = await supabase.from("attempts").insert({ ...row, client_id: clientId });
  // 23505 (unique violation): an earlier try already saved this answer.
  if (!error || error.code === "23505") return { ok: true };
  console.error("saving an answer failed:", error.message);
  return { ok: false, error: "failed" };
}

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
