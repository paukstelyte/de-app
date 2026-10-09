// The fixed A1–C2 grammar topic catalogue (lib/grammar/topics.json): the
// Grammar Topics library, the topic pages and, later, Customized Learning's
// suggestions all use it. A topic's slug is its web address — never rename one.
import data from "./topics.json" with { type: "json" };

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_NAMES: Record<Level, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

export type Exercise = { title: string; href: string };
export type GrammarTopic = {
  slug: string;
  title: string;
  level: Level;
  group: string;
  summary: string;
  exercises?: Exercise[];
  rulesHref?: string;
};

export const TOPICS = data as GrammarTopic[];

export function getTopic(slug: string): GrammarTopic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

/** Every level in order with its topics, in the catalogue's order. */
export function topicsByLevel(): { level: Level; topics: GrammarTopic[] }[] {
  return LEVELS.map((level) => ({ level, topics: TOPICS.filter((t) => t.level === level) }));
}
