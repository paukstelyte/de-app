"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { recordExerciseAnswer } from "@/app/topics/[slug]/practice/actions";
import { ROUND_SIZE, correctAnswer, isCorrect, makeRound, normalise, shuffle } from "@/lib/exercises/check";
import type { ChoiceItem, ExerciseItem, OrderItem, TypeItem } from "@/lib/exercises/types";

const card = "border border-[var(--line)] bg-[var(--paper)] shadow-[8px_8px_0_var(--accent)]";
const pill = "inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const pillPrimary = `${pill} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`;
const pillSecondary = `${pill} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`;
const tile = "rounded-lg border px-3 py-2 text-base font-medium transition-colors";
const tileIdle = "border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
const good = "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
const bad = "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
const muted = "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600";

type Answered = { answer: string; correct: boolean };
/** An exercise, optionally tagged with its topic when a round mixes topics ("Practise my focus"). */
type SessionItem = ExerciseItem & { topic?: string };
type Result = { item: SessionItem; correct: boolean };

// The round is shuffled with Math.random, so it is only rendered in the browser
// (the server sends an empty card of the same size, like the flashcard game).
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

export function ExerciseSession({ slug, title, items, loggedIn, backHref = `/topics/${slug}`, practiceHref = `/topics/${slug}/practice`, topicTitles }: {
  slug: string;
  title: string;
  items: SessionItem[];
  loggedIn: boolean;
  backHref?: string;
  practiceHref?: string;
  /** Set for mixed rounds: shows each question's topic and saves the answer under it. */
  topicTitles?: Record<string, string>;
}) {
  const mounted = useMounted();
  const [round, setRound] = useState(() => makeRound(items));
  const [roundNo, setRoundNo] = useState(0);
  const [mode, setMode] = useState<"normal" | "mistakes">("normal");
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  if (!mounted) return <div aria-hidden className={`min-h-[380px] ${card}`} />;

  function start(next: SessionItem[], nextMode: "normal" | "mistakes") {
    setRound(next);
    setRoundNo((n) => n + 1);
    setMode(nextMode);
    setIndex(0);
    setAnswered(null);
    setResults([]);
  }

  const score = results.filter((r) => r.correct).length;

  if (index >= round.length) {
    const misses = results.filter((r) => !r.correct).map((r) => r.item);
    return (
      <div className={`flex flex-col items-center gap-4 p-8 text-center ${card}`}>
        <h2 className="text-xl font-semibold">{mode === "mistakes" ? "Mistakes round complete!" : "Round complete!"}</h2>
        <p id="round-score" role="status" className="text-sm text-zinc-600 dark:text-zinc-400">You got {score} of {round.length}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {misses.length > 0 && (
            <button type="button" autoFocus aria-describedby="round-score" onClick={() => start(misses, "mistakes")} className={pillPrimary}>
              Practise my mistakes ({misses.length})
            </button>
          )}
          <button type="button" autoFocus={misses.length === 0} aria-describedby={misses.length === 0 ? "round-score" : undefined} onClick={() => start(makeRound(items), "normal")} className={misses.length ? pillSecondary : pillPrimary}>
            Next {ROUND_SIZE} →
          </button>
        </div>
        <Link href={backHref} className="text-sm underline underline-offset-2">Back to {title}</Link>
        {!loggedIn && (
          <Link href={`/login?next=${practiceHref}`} className="text-sm underline underline-offset-2">Log in to save your progress</Link>
        )}
      </div>
    );
  }

  const item = round[index];
  function answer(a: string) {
    if (answered) return;
    const correct = isCorrect(item, a);
    setAnswered({ answer: a, correct });
    setResults((rs) => [...rs, { item, correct }]);
    // Fire-and-forget: a failed save must never block the exercise.
    if (loggedIn) recordExerciseAnswer(item.topic ?? slug, item.id, a).catch(console.error);
  }

  const solution = item.type === "order" ? correctAnswer(item) : fill(item.prompt, correctAnswer(item));
  const view = { answered, onAnswer: answer };
  const key = `${roundNo}-${index}`; // remount per question: fresh shuffle, input and focus
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        {mode === "mistakes" && "Mistakes · "}Question {index + 1} of {round.length} · {score} correct
        {item.topic && topicTitles?.[item.topic] && <> · <Link href={`/topics/${item.topic}`} className="underline underline-offset-2">{topicTitles[item.topic]}</Link></>}
      </p>
      <div className={`flex min-h-[380px] flex-col justify-center gap-6 p-6 sm:p-10 ${card}`}>
        {item.type === "choice" && <ChoiceView key={key} item={item} {...view} />}
        {item.type === "type" && <TypeView key={key} item={item} {...view} />}
        {item.type === "order" && <OrderView key={key} item={item} {...view} />}
        <p role="status" className="sr-only">
          {answered && (answered.correct ? "Correct!" : `Not quite. Correct answer: ${solution}`)}
        </p>
        {answered && (
          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5">
            <p className={`text-sm font-semibold ${answered.correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {answered.correct ? "Correct!" : "Not quite."}
            </p>
            {!answered.correct && (
              <p className="text-sm">
                Answer: <b lang="de">{solution}</b>
              </p>
            )}
            {!answered.correct && item.type === "type" && item.answers.some((a) => normalise(a).toLowerCase() === normalise(answered.answer).toLowerCase()) && (
              <p className="text-sm">Check the capital letters.</p>
            )}
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.explanation}</p>
            <button type="button" autoFocus onClick={() => { setAnswered(null); setIndex(index + 1); }} className={`self-start ${pillPrimary}`}>
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type ViewProps<T> = { item: T; answered: Answered | null; onAnswer: (a: string) => void };

const fill = (prompt: string, word: string) => prompt.replace("___", word);

function Sentence({ prompt, gap }: { prompt: string; gap: ReactNode }) {
  const [before, after] = prompt.split("___");
  return <p lang="de" className="text-2xl font-semibold leading-relaxed tracking-[-0.03em] sm:text-3xl">{before}{gap}{after}</p>;
}

const blank = <span className="inline-block min-w-16 border-b-2 border-current align-baseline">&nbsp;</span>;

function ChoiceView({ item, answered, onAnswer }: ViewProps<ChoiceItem>) {
  const [options] = useState(() => shuffle(item.options));
  return (
    <>
      <Sentence prompt={item.prompt} gap={answered ? <u className="underline-offset-4">{answered.answer}</u> : blank} />
      <div role="group" aria-label="Choose the answer" className="flex flex-wrap gap-3">
        {options.map((o, i) =>
          answered ? (
            <span key={o} lang="de" className={`${tile} ${o === item.answer ? good : o === answered.answer ? bad : muted}`}>{o}</span>
          ) : (
            <button key={o} lang="de" type="button" autoFocus={i === 0} onClick={() => onAnswer(o)} className={`${tile} ${tileIdle}`}>{o}</button>
          ),
        )}
      </div>
    </>
  );
}

function TypeView({ item, answered, onAnswer }: ViewProps<TypeItem>) {
  const [value, setValue] = useState("");
  const label = fill(item.prompt, "blank") + (item.hint ? ` ${item.hint}` : "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onAnswer(value); }} className="flex flex-col gap-5">
      <Sentence
        prompt={item.prompt}
        gap={
          <>
            <input
              aria-label={label}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              lang="de"
              readOnly={!!answered}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`mx-1 w-36 max-w-full rounded-md border-2 bg-transparent px-2 py-0.5 text-[0.8em] outline-none ${answered ? (answered.correct ? good : bad) : "border-zinc-400 focus:border-zinc-900 dark:border-zinc-600 dark:focus:border-zinc-100"}`}
            />
            {item.hint && <span className="text-[0.6em] font-normal text-zinc-500">{item.hint} </span>}
          </>
        }
      />
      {!answered && <button type="submit" disabled={!value.trim()} className={`self-start ${pillPrimary}`}>Check</button>}
    </form>
  );
}

function OrderView({ item, answered, onAnswer }: ViewProps<OrderItem>) {
  const [words] = useState(() => shuffle(item.words));
  const [placed, setPlaced] = useState<number[]>([]); // indices into `words`
  const pool = useRef<HTMLDivElement>(null);
  // After a tile moves, keep keyboard focus in the tile pool (Check autofocuses once every tile is placed).
  const refocus = (i?: number) =>
    requestAnimationFrame(() =>
      pool.current?.querySelector<HTMLButtonElement>(i === undefined ? "button:enabled" : `[data-i="${i}"]`)?.focus());
  const sentence = placed.map((i) => words[i]).join(" ");

  return (
    <>
      {item.translation && <p className="text-sm text-zinc-500">{item.translation}</p>}
      <div aria-label="Your sentence" role="group" lang="de" className={`flex min-h-14 flex-wrap items-center gap-2 border-b-2 pb-2 ${answered ? (answered.correct ? "border-emerald-500" : "border-red-500") : "border-zinc-300 dark:border-zinc-700"}`}>
        {placed.map((i) =>
          answered ? (
            <span key={i} className="text-xl font-semibold">{words[i]}</span>
          ) : (
            <button key={i} type="button" aria-label={`Remove ${words[i]}`} onClick={() => { setPlaced((ps) => ps.filter((p) => p !== i)); refocus(i); }} className={`${tile} ${tileIdle}`}>
              {words[i]}
            </button>
          ),
        )}
      </div>
      {!answered && (
        <>
          <div ref={pool} role="group" aria-label="Words" lang="de" className="flex flex-wrap gap-2">
            {words.map((w, i) => (
              <button key={i} data-i={i} type="button" autoFocus={i === 0} disabled={placed.includes(i)} onClick={() => { setPlaced((ps) => [...ps, i]); refocus(); }} className={`${tile} ${tileIdle} disabled:opacity-25`}>
                {w}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {placed.length === words.length && <button type="button" autoFocus onClick={() => onAnswer(sentence)} className={pillPrimary}>Check</button>}
            <button type="button" disabled={!placed.length} onClick={() => { setPlaced([]); refocus(); }} className={pillSecondary}>Clear</button>
          </div>
        </>
      )}
    </>
  );
}
