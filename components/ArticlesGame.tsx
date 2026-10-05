"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { recordAttempt } from "@/app/articles/actions";
import { useFlashcards } from "@/lib/flashcards/context";
import { ARTICLES, getFlashcardStatus, type Article } from "@/lib/flashcards/types";
import { ROUND_SIZE } from "@/lib/flashcards/practice";
import { usePracticeSession } from "@/lib/flashcards/usePracticeSession";
import { formatRuleText } from "@/lib/flashcards/ruleFormatting";
import { StatusBadge } from "@/components/StatusBadge";
import { RULE_TEXT_BY_ID } from "@/lib/flashcards/storage";

const buttonBase =
  "rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-colors";
const buttonIdle =
  "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
const buttonCorrect =
  "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300";
const buttonWrong =
  "border-red-500 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300";
const buttonMuted =
  "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600";

function getArticleButtonStyle(isCorrectAnswer: boolean, isWrongChoice: boolean) {
  if (isCorrectAnswer) return buttonCorrect;
  if (isWrongChoice) return buttonWrong;
  return buttonMuted;
}

const pillPrimary =
  "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const sideLink =
  "border-b border-zinc-900 pb-0.5 font-medium text-zinc-900 transition-colors hover:border-[var(--accent-deep)] hover:text-[var(--accent-deep)] dark:border-zinc-100 dark:text-zinc-100";
const pillSecondary =
  "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export function ArticlesGame({
  loggedIn,
  troubleIds,
  mistakesOnly,
}: {
  loggedIn: boolean;
  troubleIds?: string[];
  mistakesOnly: boolean;
}) {
  const router = useRouter();
  const { cards, recordAnswer } = useFlashcards();
  const {
    queue,
    effectiveIndex,
    chosen,
    isRecap,
    deckScore,
    decksPlayed,
    mistakesLearned,
    baseStats,
    wrongThisPass,
    choose,
    advance,
    nextRound,
    restart,
    startRecap,
  } = usePracticeSession(
    cards,
    (id, article, wasCorrect) => {
      recordAnswer(id, wasCorrect);
      // Fire-and-forget: a failed save must never block the game.
      if (loggedIn) recordAttempt(id, article).catch(console.error);
    },
    troubleIds,
    mistakesOnly,
  );

  const roundOver = !!queue && effectiveIndex >= queue.length;
  // Re-fetch the saved trouble list once a round ends, so the next round and
  // the "Practise my mistakes" count reflect the answers just given.
  useEffect(() => {
    if (roundOver && loggedIn) router.refresh();
  }, [roundOver, loggedIn, router]);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr] lg:items-start">
      <aside className="flex flex-col gap-5 lg:pt-3">
        <div>
          <div className="mb-5 h-2 w-12 bg-[var(--accent)]" />
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">German article practice / 01</p>
          <h1 className="mt-3 text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">die · der · das</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Learn German noun articles and the rules behind them.
          </p>
        </div>

        <div className="border-t border-[var(--line)] pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">How to use</h2>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            <li>Guess der, die, or das, then click the card to flip it.</li>
            <li>
              After {ROUND_SIZE} cards, choose to learn from your mistakes or
              jump to the next deck. Score keeps counting.
            </li>
            <li>
              Full reference: <Link href="/rules" className="underline underline-offset-2">The Rules</Link>.
            </li>
          </ul>
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-[var(--line)] pt-4 text-sm">
          {!loggedIn ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              <Link href="/login?next=/articles" className={sideLink}>Log in</Link> to track your
              progress and practise the words you get wrong.
            </p>
          ) : mistakesOnly ? (
            <a href="/articles" className={sideLink}>← Back to normal practice</a>
          ) : (
            <>
              {troubleIds && troubleIds.length > 0 && (
                <a href="/articles?mode=mistakes" className={sideLink}>
                  Practise my mistakes ({troubleIds.length})
                </a>
              )}
              <Link href="/progress" className={sideLink}>Your progress →</Link>
            </>
          )}
        </div>
      </aside>

      <div>
        {cards.length === 0 ? null : mistakesOnly && queue?.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 border border-[var(--line)] bg-[var(--paper)] p-8 text-center shadow-[8px_8px_0_var(--accent)]">
            <h2 className="text-xl font-semibold">No trouble words right now</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Every word you&apos;ve missed has since been answered right twice in a row.
            </p>
            <a href="/articles" className={`inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${pillPrimary}`}>
              Back to practice
            </a>
          </div>
        ) : !queue || effectiveIndex >= queue.length ? (
          <div className="flex flex-col items-center justify-center gap-4 border border-[var(--line)] bg-[var(--paper)] p-8 text-center shadow-[8px_8px_0_var(--accent)]">
            <h2 className="text-xl font-semibold">
              {isRecap ? "Recap complete!" : "Round complete!"}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This deck: {deckScore.correct}/{deckScore.total}
              {deckScore.total > 0 &&
                ` (${Math.round((deckScore.correct / deckScore.total) * 100)}%)`}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {wrongThisPass.length > 0 && (
                <button
                  type="button"
                  onClick={startRecap}
                  className={`inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${pillPrimary}`}
                >
                  Learn from your mistakes ({wrongThisPass.length})
                </button>
              )}
              {mistakesOnly ? (
                // Full page load, so the round is rebuilt from the freshly saved list.
                <a
                  href="/articles?mode=mistakes"
                  className={`inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                    wrongThisPass.length > 0 ? pillSecondary : pillPrimary
                  }`}
                >
                  Practise my mistakes again
                </a>
              ) : (
              <button
                type="button"
                onClick={nextRound}
                className={`inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  wrongThisPass.length > 0 ? pillSecondary : pillPrimary
                }`}
              >
                Next {ROUND_SIZE} words →
              </button>
              )}
            </div>
          </div>
        ) : (
          <Game
            cardId={queue[effectiveIndex]}
            positionLabel={
              isRecap
                ? `Recap ${effectiveIndex + 1} of ${queue.length}`
                : `${mistakesOnly ? "Mistake" : "Card"} ${effectiveIndex + 1} of ${queue.length}`
            }
            scoreLabel={`Score ${deckScore.correct}/${deckScore.total}`}
            chosen={chosen}
            onRestart={restart}
            onChoose={choose}
            onAdvance={advance}
          />
        )}
      </div>
      </div>

      <section className="grid grid-cols-3 gap-px border border-[var(--line)] bg-[var(--line)]">
        <Stat label="Decks played" value={decksPlayed} />
        <Stat label="Mistakes fixed" value={mistakesLearned} />
        <Stat
          label="Overall accuracy"
          value={
            baseStats.total > 0
              ? `${Math.round((baseStats.correct / baseStats.total) * 100)}%`
              : "—"
          }
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--paper)] p-4 text-center">
      <div className="text-2xl font-semibold tracking-[-0.04em]">{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function Game({
  cardId,
  positionLabel,
  scoreLabel,
  chosen,
  onRestart,
  onChoose,
  onAdvance,
}: {
  cardId: string;
  positionLabel: string;
  scoreLabel: string;
  chosen: Article | null;
  onRestart: () => void;
  onChoose: (article: Article, cardId: string, correctArticle: Article) => void;
  onAdvance: () => void;
}) {
  const { cards } = useFlashcards();
  const card = cards.find((c) => c.id === cardId);
  if (!card) return null;

  const isCorrect = chosen === card.article;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        <span>{positionLabel}</span>
        <span>{scoreLabel}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRestart();
          }}
          className="border-b border-zinc-400 pb-0.5 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-600 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
        >
          Restart
        </button>
      </div>

      <div
        onClick={() => {
          if (chosen) onAdvance();
        }}
        className={`relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden border border-[var(--line)] bg-[var(--paper)] p-8 text-center shadow-[8px_8px_0_var(--accent)] sm:p-12 ${
          chosen ? "cursor-pointer" : ""
        }`}
      >
        <span className="absolute right-5 top-5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-600">noun / article</span>
        <span className="absolute bottom-5 left-5 h-5 w-5 border-b border-l border-[var(--line)]" />
        <p className="text-4xl font-bold tracking-[-0.06em] sm:text-5xl">{card.noun}</p>

        <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">
          {ARTICLES.map((article) => {
            if (!chosen) {
              return (
                <button
                  key={article}
                  type="button"
                  onClick={() => onChoose(article, card.id, card.article)}
                  className={`${buttonBase} ${buttonIdle}`}
                >
                  {article}
                </button>
              );
            }
            const isCorrectAnswer = article === card.article;
            const isWrongChoice = chosen === article && !isCorrectAnswer;
            const style = getArticleButtonStyle(isCorrectAnswer, isWrongChoice);
            return (
              <div key={article} className={`${buttonBase} ${style}`}>
                {article}
              </div>
            );
          })}
        </div>

        {chosen && (
          <div className="mt-6 flex w-full flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <p
                className={`text-sm font-medium ${
                  isCorrect
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isCorrect ? "Correct!" : "Not quite."}
              </p>
              <StatusBadge status={getFlashcardStatus(card)} />
            </div>

            <div className="text-left">
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Rule
              </h2>
              <p className="mt-1 text-sm">{formatRuleText(RULE_TEXT_BY_ID.get(card.ruleId) ?? "")}</p>
            </div>

            {card.exception && (
              <div className="text-left">
                <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Exception
                </h2>
                <p className="mt-1 text-sm">{formatRuleText(card.exception)}</p>
              </div>
            )}

            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Click anywhere to continue →
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
