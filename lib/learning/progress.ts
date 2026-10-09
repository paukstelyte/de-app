// Per-topic progress from the answer history (public.attempts). The attempts
// table names topics by catalogue slug, except the flashcards, which use "articles".

export const slugForAttemptTopic = (topic: string): string => (topic === "articles" ? "noun-gender" : topic);
export type TopicProgress = { total: number; correct: number; lastPractised: string | null };

export function topicProgress(rows: { topic: string; correct: boolean; created_at: string }[]): Record<string, TopicProgress> {
  const out: Record<string, TopicProgress> = {};
  for (const r of rows) {
    const slug = slugForAttemptTopic(r.topic);
    const p = (out[slug] ??= { total: 0, correct: 0, lastPractised: null });
    p.total += 1;
    p.correct += r.correct ? 1 : 0;
    if (!p.lastPractised || r.created_at > p.lastPractised) p.lastPractised = r.created_at;
  }
  return out;
}
