"use server";

import { createClient } from "@/lib/supabase/server";
import { loadFlashcards } from "@/lib/flashcards/storage";
import { ARTICLES, type Article } from "@/lib/flashcards/types";

const CARDS = new Map(loadFlashcards().map((c) => [c.id, c]));

/** Saves one answer for the logged-in user. Correctness is decided here, not
 * trusted from the browser, so stats can't be inflated by a crafted request. */
export async function recordAttempt(itemId: string, answer: Article) {
  const card = CARDS.get(itemId);
  if (!card || !ARTICLES.includes(answer)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("attempts").insert({
    topic: "articles",
    item_id: itemId,
    answer,
    correct: answer === card.article,
  });
  if (error) console.error("recordAttempt failed:", error.message);
}
