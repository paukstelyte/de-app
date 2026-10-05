"use server";

import { createClient } from "@/lib/supabase/server";
import { loadFlashcards } from "@/lib/flashcards/storage";
import { ARTICLES, type Article } from "@/lib/flashcards/types";

const CARDS = new Map(loadFlashcards().map((c) => [c.id, c]));

/** Saves one answer for the logged-in user. Correctness is decided here, not
 * trusted from the browser. (A user calling the database API directly could
 * still fake their *own* stats — RLS keeps it to their rows, and the table's
 * size limits and rate-limit trigger stop them filling the database.) */
export async function recordAttempt(itemId: string, answer: Article) {
  const card = CARDS.get(itemId);
  if (!card || !ARTICLES.includes(answer)) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return; // guests' answers stay in their browser

  const { error } = await supabase.from("attempts").insert({
    topic: "articles",
    item_id: itemId,
    answer,
    correct: answer === card.article,
  });
  if (error) console.error("recordAttempt failed:", error.message);
}
