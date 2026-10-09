"use server";

import { EXERCISE_SETS } from "@/lib/exercises/sets";
import { isCorrect } from "@/lib/exercises/check";
import { createClient } from "@/lib/supabase/server";

/** Saves one exercise answer for the logged-in user; correctness is decided here. Guests: no-op. */
export async function recordExerciseAnswer(slug: unknown, itemId: unknown, answer: unknown): Promise<void> {
  if (typeof slug !== "string" || typeof itemId !== "string" || typeof answer !== "string") return;
  if (!Object.hasOwn(EXERCISE_SETS, slug) || answer.length > 500) return;
  const item = EXERCISE_SETS[slug].items.find((i) => i.id === itemId);
  if (!item) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return;

  const { error } = await supabase.from("attempts").insert({
    topic: slug,
    item_id: itemId,
    answer: answer.slice(0, 64) || "-",
    correct: isCorrect(item, answer),
  });
  if (error) console.error("recordExerciseAnswer failed:", error.message);
}
