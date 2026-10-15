import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentList } from "@/components/learning/DocumentList";
import { FocusList } from "@/components/learning/FocusList";
import { UploadBox } from "@/components/learning/UploadBox";
import { LoadError } from "@/components/LoadError";
import { ANALYSIS_MODEL } from "@/lib/learning/analyse";
import { getAllAttempts } from "@/lib/attempts";
import { TOPICS } from "@/lib/grammar/topics";
import { EXERCISE_SETS } from "@/lib/exercises/sets";
import { practiceTopics } from "@/lib/learning/focus-practice";
import { parseAllowance } from "@/lib/learning/allowance";
import { loadDocumentsAndFocus } from "@/lib/learning/load-focus";
import { topicProgress } from "@/lib/learning/progress";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Customized Learning" };
const TOPIC_MAP = Object.fromEntries(TOPICS.map((t) => [t.slug, t]));

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
  // proxy.ts sends signed-out visitors to /login; this is a second guard.
  if (!userId) redirect("/login?next=/learning");

  const [loaded, attempts, { data: allowanceRow }] = await Promise.all([
    loadDocumentsAndFocus(supabase),
    getAllAttempts(),
    supabase.rpc("upload_allowance"),
  ]);
  const docs = loaded.ok ? loaded.documents : [];
  const focus = loaded.ok ? loaded.focus : [];
  // Without the document count the upload box can't show the document limit, so it shows no allowance.
  const allowance = loaded.ok ? parseAllowance(allowanceRow, docs.length) : null;
  const practiceSlugs = practiceTopics(focus.map((f) => f.slug), EXERCISE_SETS);
  const progress = topicProgress(attempts);
  const isEmpty = docs.length === 0 && focus.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {intro}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <UploadBox userId={userId} modelSlug={ANALYSIS_MODEL} allowance={allowance} />
        <section className="flex flex-col gap-3" aria-labelledby="focus-title">
          <h2 id="focus-title" className="section-heading">Your focus now</h2>
          {!loaded.ok ? (
            <LoadError what="your focus list and documents" />
          ) : isEmpty ? (
            <ol className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><b>1.</b> Upload a textbook page, worksheet, notes or homework.</li>
              <li><b>2.</b> An AI model reads it and picks the grammar topics it covers, and any mistakes.</li>
              <li><b>3.</b> Practise those topics and watch your progress here.</li>
              <li className="pt-2">Or start now: <Link href="/topics" className="underline underline-offset-2">Grammar Topics</Link> · <Link href="/articles" className="underline underline-offset-2">der · die · das</Link></li>
            </ol>
          ) : (
            <>
              {practiceSlugs.length > 0 && (
                <Link href="/learning/practice" className="pill-primary self-start">
                  Practise my focus ({practiceSlugs.length} {practiceSlugs.length === 1 ? "topic" : "topics"})
                </Link>
              )}
              <FocusList items={focus} topics={TOPIC_MAP} progress={progress} />
            </>
          )}
        </section>
      </div>
      {docs.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="docs-title">
          <h2 id="docs-title" className="section-heading">Your documents ({docs.length})</h2>
          <DocumentList docs={docs} topics={TOPIC_MAP} />
        </section>
      )}
    </div>
  );
}
