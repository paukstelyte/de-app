"use server";

import { EXERCISE_SETS } from "@/lib/exercises/sets";
import { isCorrect } from "@/lib/exercises/check";
import { saveAttempt, type SaveResult } from "@/lib/attempts";

/** Saves one exercise answer for the logged-in user; correctness is decided here. */
export async function recordExerciseAnswer(slug: unknown, itemId: unknown, answer: unknown, clientId: unknown): Promise<SaveResult> {
  if (typeof slug !== "string" || typeof itemId !== "string" || typeof answer !== "string") return { ok: false, error: "invalid" };
  if (!Object.hasOwn(EXERCISE_SETS, slug) || answer.length > 500) return { ok: false, error: "invalid" };
  const item = EXERCISE_SETS[slug].items.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: "invalid" };
  return saveAttempt({ topic: slug, item_id: itemId, answer: answer.slice(0, 64) || "-", correct: isCorrect(item, answer) }, clientId);
}
