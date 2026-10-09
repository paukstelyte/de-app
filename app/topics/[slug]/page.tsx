import Link from "next/link";
import { notFound } from "next/navigation";
import { LevelBadge } from "@/components/LevelBadge";
import { getArticlesProgress } from "@/lib/attempts";
import { LEVEL_NAMES, TOPICS, getTopic } from "@/lib/grammar/topics";
import { percent } from "@/lib/progress";

// Only the catalogue's topics exist; any other address shows the "not found" page.
export const dynamicParams = false;
export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/topics/[slug]">) {
  const topic = getTopic((await params).slug);
  return { title: topic ? topic.title : "Topic not found" };
}

const pillPrimary =
  "inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const heading = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";

export default async function TopicPage({ params }: PageProps<"/topics/[slug]">) {
  const topic = getTopic((await params).slug);
  if (!topic) notFound();

  const sameLevel = TOPICS.filter((t) => t.level === topic.level);
  const i = sameLevel.indexOf(topic);
  const prev = sameLevel[i - 1];
  const next = sameLevel[i + 1];
  const articles = topic.slug === "noun-gender" ? await getArticlesProgress() : null;

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
          <Link href="/topics" className="underline-offset-2 hover:underline">Grammar Topics</Link>
          {" › "}
          <Link href={`/topics#${topic.level}`} className="underline-offset-2 hover:underline">{topic.level}</Link>
        </nav>
        <div className="mt-4 flex items-center gap-3">
          <LevelBadge level={topic.level} />
          <span className="text-sm text-zinc-500">
            {LEVEL_NAMES[topic.level]} · {topic.group}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.05em] sm:text-4xl">{topic.title}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-zinc-700 dark:text-zinc-300">{topic.summary}</p>
      </div>

      <section className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[8px_8px_0_var(--accent)] sm:p-6">
        <h2 className={heading}>Practise</h2>
        {topic.exercises?.length ? (
          <ul className="flex flex-col gap-3">
            {topic.exercises.map((ex) => (
              <li key={ex.href} className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-semibold">{ex.title}</span>
                <Link href={ex.href} className={pillPrimary}>Start</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Exercises coming soon. This topic&apos;s exercises are being built.
          </p>
        )}
        {articles && articles.overall.total > 0 && (
          <p className="text-sm">
            Your accuracy so far: <b>{percent(articles.overall)}%</b> over {articles.overall.total} answers.{" "}
            <Link href="/progress" className="underline underline-offset-2">See your progress</Link>
          </p>
        )}
        {topic.rulesHref && (
          <p className="text-sm">
            <Link href={topic.rulesHref} className="underline underline-offset-2">Read the rules behind it</Link>
          </p>
        )}
      </section>

      {(prev || next) && (
        <nav aria-label={`More ${topic.level} topics`} className="flex flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5 text-sm">
          {prev ? (
            <Link href={`/topics/${prev.slug}`} className="underline-offset-2 hover:underline">← {prev.title}</Link>
          ) : <span />}
          {next && (
            <Link href={`/topics/${next.slug}`} className="text-right underline-offset-2 hover:underline">{next.title} →</Link>
          )}
        </nav>
      )}
    </article>
  );
}
