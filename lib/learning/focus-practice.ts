// "Practise my focus": one pool of exercises from the topics the AI picked for
// you (plus any you added). Type-only import, so Node tests load it directly.
import type { ExerciseItem, ExerciseSet } from "../exercises/types.ts";

type TopicItem = ExerciseItem & { topic: string };

/** The topics that have a practice set (noun-gender and unknown slugs drop out), in focus order. */
export function practiceTopics(slugs: string[], sets: Record<string, ExerciseSet>): string[] {
  return slugs.filter((s) => Object.hasOwn(sets, s));
}

/** Every exercise of the given topics that have a practice set, tagged with its topic. */
export function focusPracticeItems(slugs: string[], sets: Record<string, ExerciseSet>): TopicItem[] {
  return practiceTopics(slugs, sets).flatMap((s) => sets[s].items.map((item) => ({ ...item, topic: s })));
}
