import Link from "next/link";
import { redirect } from "next/navigation";
import rules from "@/lib/flashcards/data/rules.json";
import { loadFlashcards } from "@/lib/flashcards/storage";
import { ARTICLES } from "@/lib/flashcards/types";
import { getArticlesProgress } from "@/lib/attempts";
import { percent, type Score } from "@/lib/progress";
import { getTopic } from "@/lib/grammar/topics";

export const metadata = { title: "Your progress" };

const CARDS = new Map(loadFlashcards().map((c) => [c.id, c]));
const RULE_TITLES = new Map(rules.map((r) => [r.id, r.title]));
const TROUBLE_SHOWN = 30;

const pillPrimary =
  "inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const panel = "border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6";
const heading =
  "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";

export default async function ProgressPage() {
  const progress = await getArticlesProgress();
  if (!progress) redirect("/login?next=/progress");
  const topic = getTopic("noun-gender")!;
  const { overall, byArticle, byRule, trouble } = progress;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="mb-5 h-2 w-12 bg-[var(--accent)]" />
        <h1 className="text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">Your progress</h1>
      </div>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold tracking-[-0.04em]">{topic.title}</h2>

        {overall.total === 0 ? (
          <div className={`${panel} text-sm text-zinc-600 dark:text-zinc-400`}>
            No answers yet.{" "}
            <Link href={topic.exercises![0].href} className="underline underline-offset-2">
              Play a round
            </Link>{" "}
            and your stats will show up here.
          </div>
        ) : (
          <>
            <div className="grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
              <Stat label={`Overall · ${overall.total} answers`} score={overall} />
              {ARTICLES.map((a) => (
                <Stat key={a} label={`${a} words`} score={byArticle[a]} />
              ))}
            </div>

            <div className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className={heading}>Trouble words ({trouble.length})</h3>
                {trouble.length > 0 && (
                  <a href="/articles?mode=mistakes" className={pillPrimary}>
                    Practise my mistakes
                  </a>
                )}
              </div>
              {trouble.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  None right now — every word you missed has since been answered right twice in a row.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-zinc-500">
                    A word leaves this list after 2 correct answers in a row.
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {trouble.slice(0, TROUBLE_SHOWN).map(({ id, misses }) => {
                      const card = CARDS.get(id)!;
                      return (
                        <li key={id} className="rounded-full border border-[var(--line)] px-3 py-1 text-sm">
                          {card.article} {card.noun}
                          <span className="ml-1.5 text-xs text-zinc-500">×{misses}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {trouble.length > TROUBLE_SHOWN && (
                    <p className="mt-3 text-xs text-zinc-500">
                      …and {trouble.length - TROUBLE_SHOWN} more.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className={panel}>
              <h3 className={heading}>Accuracy by rule</h3>
              <p className="mt-2 text-xs text-zinc-500">Weakest first. Tap a rule to read it.</p>
              <ul className="mt-4 flex flex-col divide-y divide-[var(--line)]">
                {[...byRule]
                  .sort(([, a], [, b]) => (percent(a) ?? 0) - (percent(b) ?? 0))
                  .map(([ruleId, score]) => (
                    <li key={ruleId} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <Link href={`/rules#${ruleId}`} className="hover:underline">
                        {RULE_TITLES.get(ruleId) ?? ruleId}
                      </Link>
                      <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
                        {percent(score)}% · {score.correct}/{score.total}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, score }: { label: string; score: Score }) {
  const value = percent(score);
  return (
    <div className="bg-[var(--paper)] p-4 text-center">
      <div className="text-2xl font-semibold tracking-[-0.04em]">{value === null ? "—" : `${value}%`}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
    </div>
  );
}
