"use client";

import { useState, useTransition } from "react";
import { setFocus } from "@/app/learning/actions";

export function FocusButton({ slug, inFocus }: { slug: string; inFocus: boolean }) {
  const [on, setOn] = useState(inFocus);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toggle = () => start(async () => {
    const r = await setFocus(slug, on ? "removed" : "added");
    if (r.error) setError(r.error); else { setOn(!on); setError(""); }
  });
  return (
    <p className="text-sm">
      {on && <span className="mr-2 font-semibold">In your focus ·</span>}
      <button type="button" disabled={pending} onClick={toggle} className="underline underline-offset-2">
        {on ? "Remove from my focus" : "Add to my focus"}
      </button>
      {error && <span role="alert" className="ml-2 text-red-600 dark:text-red-400">{error}</span>}
    </p>
  );
}
