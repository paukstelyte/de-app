import Link from "next/link";
import { LevelBadge } from "@/components/LevelBadge";
import { getArticlesProgress } from "@/lib/attempts";
import { LEVEL_NAMES, TOPICS, topicsByLevel, type GrammarTopic } from "@/lib/grammar/topics";
import { percent } from "@/lib/progress";

export const metadata = { title: "Grammar Topics" };

const heading = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";

export default async function TopicsPage() {
  // Only noun gender has exercises (and answer history) so far; null for guests.
  const articles = await getArticlesProgress();
  const progress: Record<string, string> = {};
  if (articles && articles.overall.total > 0) {
    progress["noun-gender"] = `Your accuracy ${percent(articles.overall)}% · ${articles.overall.total} answers`;
  }
  const levels = topicsByLevel();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="mb-4 h-2 w-12 bg-[var(--accent)]" />
        <p className={heading}>German grammar · A1–C2</p>
        <h1 className="mt-3 text-3xl font-bold leading-none tracking-[-0.06em] sm:text-4xl">Grammar Topics</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          All {TOPICS.length} grammar topics from beginner (A1) to proficient (C2). Open a topic to read
          what it&apos;s about and practise it. Exercises are being added topic by topic.
        </p>
        <nav aria-label="Jump to a level" className="mt-5 flex flex-wrap gap-2">
          {levels.map(({ level, topics }) => (
            <a
              key={level}
              href={`#${level}`}
              className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              {level} <span className="tabular-nums text-zinc-500">{topics.length}</span>
            </a>
          ))}
        </nav>
      </div>

      {levels.map(({ level, topics }) => (
        <section key={level} id={level} className="flex scroll-mt-6 flex-col gap-4" aria-labelledby={`${level}-title`}>
          <h2 id={`${level}-title`} className="flex items-baseline gap-3 text-2xl font-bold tracking-[-0.04em]">
            {level}
            <span className="text-sm font-medium tracking-normal text-zinc-500">{LEVEL_NAMES[level]}</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {topics.map((topic) => (
              <li key={topic.slug}>
                <TopicCard topic={topic} progress={progress[topic.slug]} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TopicCard({ topic, progress }: { topic: GrammarTopic; progress?: string }) {
  const exercises = topic.exercises?.length ?? 0;
  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="flex h-full flex-col gap-2 border border-[var(--line)] bg-[var(--paper)] p-4 transition-colors hover:border-zinc-900 dark:hover:border-zinc-100"
    >
      <span className="flex items-start gap-3">
        <LevelBadge level={topic.level} />
        <span className="font-semibold leading-snug">{topic.title}</span>
      </span>
      <span className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{topic.summary}</span>
      <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
        <span className="text-zinc-500">{topic.group}</span>
        {exercises > 0 ? (
          <span className="font-semibold">
            {exercises} {exercises === 1 ? "exercise" : "exercises"}
          </span>
        ) : (
          <span className="text-zinc-500">Exercises coming soon</span>
        )}
        {progress && <span className="font-semibold text-emerald-700 dark:text-emerald-400">{progress}</span>}
      </span>
    </Link>
  );
}
