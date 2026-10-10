import Link from "next/link";
import { DocumentList } from "@/components/learning/DocumentList";
import { FocusList } from "@/components/learning/FocusList";
import { UploadBox } from "@/components/learning/UploadBox";
import { ANALYSIS_MODEL } from "@/lib/learning/analyse";
import { formatModel } from "@/lib/learning/usage";
import { getAllAttempts } from "@/lib/attempts";
import { TOPICS } from "@/lib/grammar/topics";
import { buildFocus, type FocusOverride } from "@/lib/learning/focus";
import { topicProgress } from "@/lib/learning/progress";
import type { Suggestion } from "@/lib/learning/suggestions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Customized Learning" };
const TOPIC_MAP = Object.fromEntries(TOPICS.map((t) => [t.slug, t]));
const heading = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";
const pillPrimary = "inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

export default async function LearningPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const intro = (
    <div>
      <div className="mb-4 h-2 w-12 bg-[var(--accent)]" />
      <h1 className="text-3xl font-bold leading-none tracking-[-0.06em] sm:text-4xl">Customized Learning</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Upload what you&apos;re learning in class or on your own, and get the grammar topics to practise, with your progress on each.
      </p>
    </div>
  );
  if (!userId) {
    return (
      <div className="flex flex-col gap-6">
        {intro}
        <div className="flex flex-wrap gap-3">
          <Link href="/login?next=/learning" className={pillPrimary}>Log in to use Customized Learning</Link>
          <Link href="/auth/sign-up" className="inline-flex items-center rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium">Sign up</Link>
        </div>
      </div>
    );
  }

  const [{ data: docs }, { data: overrides }, attempts] = await Promise.all([
    supabase.from("learning_documents").select("id, title, created_at, extracted_text, no_grammar, suggestions, model, prompt_tokens, completion_tokens, cost_usd").order("created_at", { ascending: false }).limit(200),
    supabase.from("learning_focus").select("topic_slug, kind, updated_at"),
    getAllAttempts(),
  ]);
  const focus = buildFocus(
    (docs ?? []).map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at, topics: d.suggestions as Suggestion[] })),
    (overrides ?? []).map((o) => ({ slug: o.topic_slug, kind: o.kind, updatedAt: o.updated_at }) as FocusOverride),
    new Date(),
  );
  const progress = topicProgress(attempts);
  const isEmpty = !docs?.length && focus.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {intro}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <UploadBox userId={userId} modelName={formatModel(ANALYSIS_MODEL)} modelSlug={ANALYSIS_MODEL} />
        <section className="flex flex-col gap-3" aria-labelledby="focus-title">
          <h2 id="focus-title" className={heading}>Your focus now</h2>
          {isEmpty ? (
            <ol className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><b>1.</b> Upload a textbook page, worksheet, notes or homework.</li>
              <li><b>2.</b> We read it and pick the grammar topics it covers, and any mistakes.</li>
              <li><b>3.</b> Practise those topics and watch your progress here.</li>
              <li className="pt-2">Or start now: <Link href="/topics" className="underline underline-offset-2">Grammar Topics</Link> · <Link href="/articles" className="underline underline-offset-2">der · die · das</Link></li>
            </ol>
          ) : (
            <FocusList items={focus} topics={TOPIC_MAP} progress={progress} />
          )}
        </section>
      </div>
      {!!docs?.length && (
        <section className="flex flex-col gap-3" aria-labelledby="docs-title">
          <h2 id="docs-title" className={heading}>Your documents ({docs.length})</h2>
          <DocumentList docs={docs.map((d) => ({ ...d, suggestions: d.suggestions as Suggestion[] }))} topics={TOPIC_MAP} />
        </section>
      )}
    </div>
  );
}
