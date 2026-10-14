"use server";

import { saveAttempt, type SaveResult } from "@/lib/attempts";
import { loadFlashcards } from "@/lib/flashcards/storage";
import { ARTICLES, type Article } from "@/lib/flashcards/types";

const CARDS = new Map(loadFlashcards().map((c) => [c.id, c]));

/** Saves one answer for the logged-in user. Correctness is decided here, not
 * trusted from the browser. (A user calling the database API directly could
 * still fake their *own* stats — RLS keeps it to their rows, and the table's
 * size limits and rate-limit trigger stop them filling the database.) */
export async function recordAttempt(itemId: unknown, answer: unknown, clientId: unknown): Promise<SaveResult> {
  const card = typeof itemId === "string" ? CARDS.get(itemId) : undefined;
  if (!card || !ARTICLES.includes(answer as Article)) return { ok: false, error: "invalid" };
  return saveAttempt({ topic: "articles", item_id: card.id, answer: answer as Article, correct: answer === card.article }, clientId);
}
