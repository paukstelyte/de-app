"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteDocument } from "@/app/learning/actions";
import { LevelBadge } from "@/components/LevelBadge";
import type { GrammarTopic } from "@/lib/grammar/topics";
import type { Suggestion } from "@/lib/learning/suggestions";
import { formatCost, formatModel } from "@/lib/learning/usage";

type Doc = {
  id: number; title: string; created_at: string; extracted_text: string; no_grammar: boolean; suggestions: Suggestion[];
  model: string | null; prompt_tokens: number | null; completion_tokens: number | null; cost_usd: number | string | null;
};

/** "Read by Gemini 2.5 Flash Lite · 3,120 tokens · $0.0004"; older documents saved before this was recorded show nothing. */
function usageLine(doc: Doc): string | null {
  if (!doc.model) return null;
  const tokens = (doc.prompt_tokens ?? 0) + (doc.completion_tokens ?? 0);
  const cost = formatCost(doc.cost_usd === null ? null : Number(doc.cost_usd));
  return [`Read by ${formatModel(doc.model)}`, tokens > 0 ? `${tokens.toLocaleString("en-GB")} tokens` : null, cost && `about ${cost}`].filter(Boolean).join(" · ");
}
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function DocumentList({ docs, topics }: { docs: Doc[]; topics: Record<string, GrammarTopic> }) {
  return (
    <ul className="flex flex-col gap-3">
      {docs.map((d) => <DocumentItem key={d.id} doc={d} topics={topics} />)}
    </ul>
  );
}

function DocumentItem({ doc, topics }: { doc: Doc; topics: Record<string, GrammarTopic> }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const known = doc.suggestions.filter((s) => topics[s.slug]);
  return (
    <li className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{doc.title}</h3>
        <span className="text-xs text-zinc-500">{date(doc.created_at)}</span>
      </div>
      {usageLine(doc) && <p className="text-xs text-zinc-500" title={doc.model ?? undefined}>{usageLine(doc)}</p>}
      {doc.no_grammar || known.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No German grammar topics found in this document.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {known.map((s) => (
            <li key={s.slug} className="flex flex-wrap items-center gap-2 text-sm">
              <LevelBadge level={topics[s.slug].level} />
              <Link href={`/topics/${s.slug}`} className="font-medium underline underline-offset-2">{topics[s.slug].title}</Link>
              {s.fromMistake && <span className="text-xs font-semibold text-red-700 dark:text-red-400">mistake</span>}
              {s.reason && <span className="w-full text-zinc-600 dark:text-zinc-400">{s.reason}</span>}
            </li>
          ))}
        </ul>
      )}
      {doc.extracted_text && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-500">What I read</summary>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{doc.extracted_text}</p>
        </details>
      )}
      <div className="flex gap-3 text-sm">
        {confirming ? (
          <>
            <button type="button" disabled={pending} className="font-semibold text-red-700 underline underline-offset-2 dark:text-red-400"
              onClick={() => start(async () => { const r = await deleteDocument(doc.id); if (r.error) { setError(r.error); setConfirming(false); } })}>
              Yes, delete it
            </button>
            <button type="button" className="underline underline-offset-2" onClick={() => setConfirming(false)}>Keep it</button>
          </>
        ) : (
          <button type="button" className="text-zinc-500 underline underline-offset-2" onClick={() => setConfirming(true)}>Delete</button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}
