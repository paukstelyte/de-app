"use client";
import { useEffect, useRef } from "react";
import { advanceChoice, advanceDelay, clickContinues, keyContinues } from "./answer-keys";
import { storedChoice } from "./storedChoice";

/** The learner's choice for moving on after a correct answer, remembered per browser. */
export const useAdvanceChoice = storedChoice("de-app:advance", advanceChoice, advanceChoice(null));

/** After an answer: when `autoAdvance` is set (a correct answer) it moves on by itself after the learner's chosen
 * delay, unless they chose to wait; any answer moves on with a click anywhere (outside links, buttons and fields)
 * or Enter. Listeners start on the next tick, so the click or key press that gave the answer never counts; everything
 * is cleared when the question changes, so it never advances twice. Callers must reset `answered` to false between
 * questions (the effect re-arms only when it changes). Returns true while it waits for a click or Enter. */
export function useAdvance(answered: boolean, autoAdvance: boolean, next: () => void): boolean {
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; });
  const delay = advanceDelay(useAdvanceChoice()[0]);
  const auto = autoAdvance && delay !== null;
  useEffect(() => {
    if (!answered) return;
    let done = false;
    const go = () => { if (!done) { done = true; nextRef.current(); } };
    const onClick = (e: MouseEvent) => { if (clickContinues(e.target as Element | null, !!window.getSelection()?.toString())) go(); };
    const onKey = (e: KeyboardEvent) => {
      if (keyContinues(e, document.activeElement as HTMLInputElement | null)) { e.preventDefault(); go(); }
    };
    const start = setTimeout(() => {
      document.addEventListener("click", onClick);
      document.addEventListener("keydown", onKey);
    }, 0);
    const timer = auto ? setTimeout(go, delay!) : undefined;
    return () => {
      done = true;
      clearTimeout(start);
      clearTimeout(timer);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [answered, auto, delay]);
  return answered && !auto;
}
