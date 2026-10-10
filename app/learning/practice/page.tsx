import Link from "next/link";
import { redirect } from "next/navigation";
import { ExerciseSession } from "@/components/exercises/ExerciseSession";
import { EXERCISE_SETS } from "@/lib/exercises/sets";
import { TOPICS } from "@/lib/grammar/topics";
import { focusPracticeItems } from "@/lib/learning/focus-practice";
import { loadFocus } from "@/lib/learning/load-focus";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Practise my focus" };
const TITLES = Object.fromEntries(TOPICS.map((t) => [t.slug, t.title]));

/** One mixed round from the topics in "Your focus now": the ones the AI picked from your uploads, plus any you added. */
export default async function FocusPracticePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/learning/practice"); // proxy.ts does this first

  const { focus } = await loadFocus(supabase);
  const slugs = focus.map((f) => f.slug).filter((s) => Object.hasOwn(EXERCISE_SETS, s));
  const items = focusPracticeItems(slugs, EXERCISE_SETS);

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
          <Link href="/learning" className="underline-offset-2 hover:underline">Customized Learning</Link>
          {" › "}
          <span aria-current="page">Practise my focus</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-3xl font-bold leading-tight tracking-[-0.05em] sm:text-4xl">Practise my focus</h1>
          <span className="rounded-full border border-amber-500 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-400 dark:bg-amber-400/15 dark:text-amber-200">
            This exercise is still in test mode
          </span>
        </div>
        {slugs.length > 0 && (
          <p className="mt-4 max-w-2xl leading-7 text-zinc-700 dark:text-zinc-300">
            A mixed round from your focus topics: {slugs.map((s) => TITLES[s]).join(", ")}.
          </p>
        )}
      </div>
      {items.length > 0 ? (
        <ExerciseSession
          slug="focus"
          title="Customized Learning"
          items={items}
          loggedIn
          backHref="/learning"
          practiceHref="/learning/practice"
          topicTitles={TITLES}
        />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nothing to practise yet. Upload a document on <Link href="/learning" className="underline underline-offset-2">Customized Learning</Link>, or add topics from <Link href="/topics" className="underline underline-offset-2">Grammar Topics</Link>.
        </p>
      )}
    </article>
  );
}
