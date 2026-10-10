"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setFocus } from "@/app/learning/actions";
import { LevelBadge } from "@/components/LevelBadge";
import type { GrammarTopic } from "@/lib/grammar/topics";
import type { FocusItem } from "@/lib/learning/focus";
import type { TopicProgress } from "@/lib/learning/progress";
import { percent } from "@/lib/progress";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function FocusList({ items, topics, progress }: { items: FocusItem[]; topics: Record<string, GrammarTopic>; progress: Record<string, TopicProgress> }) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shown = items.filter((i) => topics[i.slug]);
  if (shown.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing in focus yet. Upload a document, or add topics from <Link href="/topics" className="underline underline-offset-2">Grammar Topics</Link>.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {shown.map((item) => {
        const topic = topics[item.slug];
        const p = progress[item.slug];
        return (
          <li key={item.slug} className="flex flex-col gap-1.5 border border-[var(--line)] bg-[var(--paper)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={topic.level} />
              <Link href={`/topics/${topic.slug}`} className="font-semibold hover:underline">{topic.title}</Link>
              {item.mistakes > 0 && <span className="rounded-full bg-red-600/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">mistakes seen</span>}
            </div>
            <p className="text-xs text-zinc-500">
              {topic.exercises?.length
                ? p ? `${p.total} answers · ${percent(p)}% correct · last practised ${date(p.lastPractised!)}` : "Not practised yet"
                : "No exercises yet"}
            </p>
            <p className="text-xs text-zinc-500">
              In focus since {date(item.since)}{item.fromTitle ? ` · from “${item.fromTitle}”` : " · added by you"}{item.documents > 1 ? ` · in ${item.documents} documents` : ""}
            </p>
            <div className="flex gap-3 text-sm">
              {topic.exercises?.[0] && <Link href={topic.exercises[0].href} className="font-semibold underline underline-offset-2">Practise</Link>}
              <button type="button" disabled={pending} className="text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => start(async () => { const r = await setFocus(item.slug, "removed"); setErrors((e) => ({ ...e, [item.slug]: r.error ?? "" })); })}>
                Remove from my focus
              </button>
            </div>
            {errors[item.slug] && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errors[item.slug]}</p>}
          </li>
        );
      })}
    </ul>
  );
}
