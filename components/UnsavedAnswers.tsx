"use client";

import { useEffect, useState } from "react";
import type { SaveResult } from "@/lib/attempts";

type Send = (clientId: string) => Promise<SaveResult>;
type Pending = { id: string; send: Send };

/** Saves answers in the background without ever blocking practice. Each answer gets its own id, so a
 * retry (same id) can never count it twice; answers that didn't save are kept for a Retry. */
export function useAnswerSaver() {
  const [unsaved, setUnsaved] = useState<Pending[]>([]);
  const [loggedOut, setLoggedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  /** True once the answer is saved, or can never be (a rejected answer); false if a retry may help. */
  async function trySend({ id, send }: Pending): Promise<boolean> {
    try {
      const result = await send(id);
      setLoggedOut(!result.ok && result.error === "logged-out");
      return result.ok || result.error === "invalid";
    } catch {
      return false; // network error: it may or may not have been saved; the id makes a retry safe either way
    }
  }

  function save(send: Send) {
    const pending = { id: crypto.randomUUID(), send };
    void trySend(pending).then((done) => {
      if (!done) setUnsaved((list) => [...list, pending]);
    });
  }

  async function retry() {
    setRetrying(true);
    const tried = unsaved;
    const stillUnsaved: Pending[] = [];
    for (const pending of tried) if (!(await trySend(pending))) stillUnsaved.push(pending);
    // Keep answers that failed meanwhile (added while retrying) as well.
    setUnsaved((list) => [...stillUnsaved, ...list.filter((p) => !tried.includes(p))]);
    setRetrying(false);
  }

  // Leaving the page would lose answers that haven't saved yet, so the browser asks first.
  const count = unsaved.length;
  useEffect(() => {
    if (count === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);

  return { count, loggedOut, retrying, save, retry };
}

/** A small line under the exercise: how many answers didn't save, and a Retry. Hidden when all saved. */
export function UnsavedAnswers({ saver }: { saver: ReturnType<typeof useAnswerSaver> }) {
  if (saver.count === 0) return null;
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-800 dark:text-amber-300">
      <span>
        {saver.count} {saver.count === 1 ? "answer" : "answers"} not saved
        {saver.loggedOut ? " because you've been logged out. Log in again in another tab, then retry." : "."}
      </span>
      {saver.loggedOut && (
        <a href="/login" target="_blank" rel="noopener" className="font-medium underline underline-offset-2">Log in</a>
      )}
      <button type="button" onClick={saver.retry} disabled={saver.retrying} className="font-medium underline underline-offset-2">
        {saver.retrying ? "Saving…" : "Retry"}
      </button>
    </p>
  );
}
