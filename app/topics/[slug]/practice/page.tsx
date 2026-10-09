import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseSession } from "@/components/exercises/ExerciseSession";
import { LevelBadge } from "@/components/LevelBadge";
import { EXERCISE_SETS } from "@/lib/exercises/sets";
import { getTopic } from "@/lib/grammar/topics";
import { createClient } from "@/lib/supabase/server";

// Only topics with an exercise set have a practice page.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(EXERCISE_SETS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/topics/[slug]/practice">) {
  const topic = getTopic((await params).slug);
  return { title: topic ? `${topic.title} — Practice` : "Practice not found" };
}

export default async function PracticePage({ params }: PageProps<"/topics/[slug]/practice">) {
  const { slug } = await params;
  const topic = getTopic(slug);
  const set = Object.hasOwn(EXERCISE_SETS, slug) ? EXERCISE_SETS[slug] : undefined;
  if (!topic || !set) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
          <Link href="/topics" className="underline-offset-2 hover:underline">Grammar Topics</Link>
          {" › "}
          <Link href={`/topics#${topic.level}`} className="underline-offset-2 hover:underline">{topic.level}</Link>
          {" › "}
          <Link href={`/topics/${slug}`} className="underline-offset-2 hover:underline">{topic.title}</Link>
          {" › "}
          <span aria-current="page">Practice</span>
        </nav>
        <div className="mt-4 flex items-center gap-3">
          <LevelBadge level={topic.level} />
          <span className="text-sm text-zinc-500">Practice</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.05em] sm:text-4xl">{topic.title}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-zinc-700 dark:text-zinc-300">{set.instructions}</p>
      </div>
      <ExerciseSession slug={slug} title={topic.title} items={set.items} loggedIn={!!data?.claims} />
    </article>
  );
}
