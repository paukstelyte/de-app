"use client";
import { useEffect, useRef } from "react";
import { ADVANCE_DELAY_MS, clickContinues, keyContinues } from "./answer-keys";

/** After an answer: a correct one moves on by itself after ADVANCE_DELAY_MS; any answer moves on with a click
 * anywhere (outside links, buttons and fields) or Enter. Listeners start on the next tick, so the click or key
 * press that gave the answer never counts; everything is cleared when the question changes, so it never advances twice. */
export function useAdvance(answered: boolean, correct: boolean, next: () => void): void {
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; });
  useEffect(() => {
    if (!answered) return;
    let done = false;
    const go = () => { if (!done) { done = true; nextRef.current(); } };
    const onClick = (e: MouseEvent) => { if (clickContinues(e.target as Element | null)) go(); };
    const onKey = (e: KeyboardEvent) => {
      if (keyContinues(e, document.activeElement as HTMLInputElement | null)) { e.preventDefault(); go(); }
    };
    const start = setTimeout(() => {
      document.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
    }, 0);
    const auto = correct ? setTimeout(go, ADVANCE_DELAY_MS) : undefined;
    return () => {
      done = true;
      clearTimeout(start);
      clearTimeout(auto);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [answered, correct]);
}
