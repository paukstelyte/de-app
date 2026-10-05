import type { Article } from "./flashcards/types";

export interface Attempt {
  item_id: string;
  correct: boolean;
}

export interface Score {
  correct: number;
  total: number;
}

export interface TroubleWord {
  id: string;
  misses: number;
}

export interface ProgressSummary {
  overall: Score;
  byArticle: Record<Article, Score>;
  byRule: Map<string, Score>;
  /** Missed at least once and not yet answered right twice in a row — most-missed first. */
  trouble: TroubleWord[];
}

/** How many correct answers in a row take a word off the trouble list. */
export const CORRECT_STREAK_TO_CLEAR = 2;

const empty = (): Score => ({ correct: 0, total: 0 });
function add(score: Score, correct: boolean) {
  score.total++;
  if (correct) score.correct++;
}

export function percent(score: Score): number | null {
  return score.total ? Math.round((score.correct / score.total) * 100) : null;
}

/** `attempts` must be oldest first. Attempts for unknown items are ignored. */
export function summarize(
  attempts: Attempt[],
  items: { id: string; article: Article; ruleId: string }[],
): ProgressSummary {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const overall = empty();
  const byArticle: Record<Article, Score> = { der: empty(), die: empty(), das: empty() };
  const byRule = new Map<string, Score>();
  const perItem = new Map<string, { misses: number; streak: number }>();

  for (const a of attempts) {
    const item = itemById.get(a.item_id);
    if (!item) continue;
    add(overall, a.correct);
    add(byArticle[item.article], a.correct);
    if (!byRule.has(item.ruleId)) byRule.set(item.ruleId, empty());
    add(byRule.get(item.ruleId)!, a.correct);

    const p = perItem.get(a.item_id) ?? { misses: 0, streak: 0 };
    if (a.correct) p.streak++;
    else {
      p.misses++;
      p.streak = 0;
    }
    perItem.set(a.item_id, p);
  }

  const trouble = [...perItem]
    .filter(([, p]) => p.misses > 0 && p.streak < CORRECT_STREAK_TO_CLEAR)
    .map(([id, p]) => ({ id, misses: p.misses }))
    .sort((a, b) => b.misses - a.misses);

  return { overall, byArticle, byRule, trouble };
}
