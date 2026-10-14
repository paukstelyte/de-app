"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** A read that failed (as opposed to one that found nothing): says so and offers a retry. */
export function LoadError({ what, onRetry }: { what: string; onRetry?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="alert" className="panel flex flex-wrap items-center justify-between gap-3 text-sm">
      <p>Couldn&apos;t load {what} just now. Nothing was lost.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => { router.refresh(); onRetry?.(); })}
        className="pill-secondary"
      >
        {pending ? "Trying again…" : "Try again"}
      </button>
    </div>
  );
}
