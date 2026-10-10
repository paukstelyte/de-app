"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { recordAttempt } from "@/app/articles/actions";
import { useFlashcards } from "@/lib/flashcards/context";
import { ARTICLES, getFlashcardStatus, type Article, type Level } from "@/lib/flashcards/types";
import { isAtOrBelow, useMaxLevel } from "@/lib/flashcards/level";
import { ROUND_SIZE } from "@/lib/flashcards/practice";
import { usePracticeSession } from "@/lib/flashcards/usePracticeSession";
import { formatRuleText } from "@/lib/flashcards/ruleFormatting";
import { StatusBadge } from "@/components/StatusBadge";
import { RULE_TEXT_BY_ID } from "@/lib/flashcards/storage";
import { CORRECT_STREAK_TO_CLEAR, percent } from "@/lib/progress";

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

const pill = "inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors";
const pillPrimary =
  `${pill} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`;
const sideLink =
  "border-b border-zinc-900 pb-0.5 font-medium text-zinc-900 transition-colors hover:border-[var(--accent-deep)] hover:text-[var(--accent-deep)] dark:border-zinc-100 dark:text-zinc-100";
const pillSecondary =
  `${pill} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`;

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
  const [maxLevel, setMaxLevel] = useMaxLevel();
  // Rounds draw only from the chosen levels ("Practise my mistakes" ignores
  // them: a missed word is worth practising whatever its level).
  const levelCards = useMemo(
    () => cards.filter((c) => isAtOrBelow(c.level, maxLevel)),
    [cards, maxLevel],
  );
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
    levelCards,
    (id, article, wasCorrect) => {
      // Logged-in answers go to the account only, never to this browser's guest
      // streaks, so the next person on a shared computer starts clean.
      // Fire-and-forget: a failed save must never block the game.
      if (loggedIn) recordAttempt(id, article).catch(console.error);
      else recordAnswer(id, wasCorrect);
    },
    troubleIds,
    mistakesOnly,
  );

  const roundOver = !!queue && queue.length > 0 && effectiveIndex >= queue.length;
  // Re-fetch the saved trouble list once a round ends, so the next round and
  // the "Practise my mistakes" count reflect the answers just given.
  useEffect(() => {
    if (roundOver && loggedIn) router.refresh();
  }, [roundOver, loggedIn, router]);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-10 lg:grid-cols-[240px_1fr] lg:items-start">
      <aside className="flex flex-col gap-4 max-lg:order-last lg:pt-3">
        <div>
          <div className="mb-4 h-2 w-12 bg-[var(--accent)]" />
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            <Link href="/topics/noun-gender" className="underline-offset-2 hover:underline">Grammar Topics › Noun gender · A1</Link>
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-none tracking-[-0.06em] sm:text-5xl">der · die · das</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Learn German noun articles and the rules behind them.
          </p>
        </div>

        <div className="border-t border-[var(--line)] pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">How to use</h2>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            <li>Choose a level, then pick der, die or das. The card flips to show the rule behind the answer.</li>
            <li>Tap the card or press Enter to go to the next word.</li>
            <li>
              After {ROUND_SIZE} words, replay the ones you missed or start the
              next {ROUND_SIZE}. Overall accuracy keeps counting until you restart.
            </li>
            <li>
              Full reference: <Link href="/rules" className="underline underline-offset-2">The Rules</Link>.
            </li>
          </ul>
        </div>

        {/* "Your progress" lives in the top nav for logged-in users, so the only
            link here is the mistakes round; the section is left out when empty. */}
        {(!loggedIn || mistakesOnly || (troubleIds?.length ?? 0) > 0) && (
          <div className="flex flex-col items-start gap-3 border-t border-[var(--line)] pt-4 text-sm">
            {!loggedIn ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                <Link href="/login?next=/articles" className={sideLink}>Log in</Link> to track your
                progress and practise the words you get wrong.
              </p>
            ) : mistakesOnly ? (
              <a href="/articles" className={sideLink}>← Back to normal practice</a>
            ) : (
              <a href="/articles?mode=mistakes" className={sideLink}>
                Practise my mistakes ({troubleIds!.length})
              </a>
            )}
          </div>
        )}
      </aside>

      <div className="flex flex-col gap-4">
        {!mistakesOnly && (
          <LevelPicker
            value={maxLevel}
            onChange={(level) => {
              setMaxLevel(level);
              nextRound(); // start a fresh round from the new word pool
            }}
          />
        )}
        {cards.length === 0 ? (
          // The deck is read in the browser, so the server sends this empty
          // slot sized like the card; without it the page jumps when the card appears.
          <div aria-hidden className="mt-7 min-h-[380px] border border-[var(--line)] bg-[var(--paper)] shadow-[8px_8px_0_var(--accent)]" />
        ) : mistakesOnly && queue?.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 border border-[var(--line)] bg-[var(--paper)] p-8 text-center shadow-[8px_8px_0_var(--accent)]">
            <h2 className="text-xl font-semibold">No trouble words right now</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Every word you&apos;ve missed has since been answered right twice in a row.
            </p>
            <a href="/articles" className={pillPrimary}>
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
              {deckScore.total > 0 && ` (${percent(deckScore)}%)`}
            </p>
            {mistakesOnly && queue && troubleIds && (
              <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
                {queue.filter((id) => !troubleIds.includes(id)).length} of {queue.length} words
                cleared from your list. A word leaves it after {CORRECT_STREAK_TO_CLEAR} correct
                answers in a row.
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              {wrongThisPass.length > 0 && (
                <button
                  type="button"
                  onClick={startRecap}
                  className={pillPrimary}
                >
                  Learn from your mistakes ({wrongThisPass.length})
                </button>
              )}
              {mistakesOnly ? (
                !troubleIds?.length ? (
                  <a href="/articles" className={pillPrimary}>
                    All cleared — back to practice
                  </a>
                ) : (
                // Full page load, so the round is rebuilt from the freshly saved list.
                <a
                  href="/articles?mode=mistakes"
                  className={wrongThisPass.length > 0 ? pillSecondary : pillPrimary}
                >
                  Practise my mistakes again ({troubleIds.length})
                </a>
                )
              ) : (
              <button
                type="button"
                onClick={nextRound}
                className={wrongThisPass.length > 0 ? pillSecondary : pillPrimary}
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
            troubleIds={loggedIn ? troubleIds ?? [] : undefined}
          />
        )}
        {!mistakesOnly && (
          // mt-2 clears the card's 8px offset shadow.
          <section className="mt-2 grid grid-cols-3 gap-px border border-[var(--line)] bg-[var(--line)]">
            <Stat label="Decks played" value={decksPlayed} />
            <Stat label="Mistakes fixed" value={mistakesLearned} />
            <Stat
              label="Overall accuracy"
              value={baseStats.total > 0 ? `${percent(baseStats)}%` : "—"}
            />
          </section>
        )}
      </div>
      </div>

    </div>
  );
}

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A1–A2" },
  { value: "B1", label: "A1–B1" },
  { value: "B2", label: "All (A1–B2)" },
];

function LevelPicker({ value, onChange }: { value: Level; onChange: (level: Level) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Word level</legend>
      <span aria-hidden className="mr-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        Level
      </span>
      {LEVEL_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => value !== option.value && onChange(option.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            value === option.value
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-2 bg-[var(--paper)] px-3 py-2 text-center">
      <span className="text-base font-semibold tracking-[-0.03em]">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{label}</span>
    </div>
  );
}

function Game({
  troubleIds,
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
  /** Logged-in only: the badge reflects the saved trouble list, not browser streaks. */
  troubleIds?: string[];
}) {
  const { cards } = useFlashcards();
  const card = cards.find((c) => c.id === cardId);
  if (!card) return null;

  const isCorrect = chosen === card.article;

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="sr-only">
        {chosen && (isCorrect ? "Correct!" : `Not quite. It's ${card.article} ${card.noun}.`)}
      </p>
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
        <span className="absolute right-5 top-5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-600">{card.level} · noun</span>
        <span className="absolute bottom-5 left-5 h-5 w-5 border-b border-l border-[var(--line)]" />
        <p className="text-4xl font-bold tracking-[-0.06em] sm:text-5xl">{card.noun}</p>

        <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">
          {ARTICLES.map((article) => {
            if (!chosen) {
              return (
                <button
                  key={article}
                  type="button"
                  // Each new card puts keyboard focus back on the answers.
                  autoFocus={article === ARTICLES[0]}
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
              <StatusBadge
                status={
                  troubleIds
                    ? troubleIds.includes(card.id) ? "needs-practice" : "unplayed"
                    : getFlashcardStatus(card)
                }
              />
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

            {/* Clicking anywhere on the card advances too; this button is what
                keyboard and screen-reader users land on after answering. */}
            <button
              type="button"
              autoFocus
              onClick={(event) => {
                event.stopPropagation();
                onAdvance();
              }}
              className="self-center rounded text-xs text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Tap or press Enter to continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
