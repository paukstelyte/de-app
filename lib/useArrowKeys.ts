"use client";
import { useEffect, useRef } from "react";
import { nextEnabled } from "./answer-keys";

/** Put the returned ref on a group of answer buttons: ← / → move focus between its enabled buttons, wrapping. */
export function useArrowKeys<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
      if (!buttons.length) return;
      const i = nextEnabled(buttons.indexOf(document.activeElement as HTMLButtonElement), buttons.map((b) => !b.disabled), e.key === "ArrowRight" ? 1 : -1);
      if (i >= 0 && buttons[i]) { e.preventDefault(); buttons[i].focus(); }
    };
    group.addEventListener("keydown", onKey);
    return () => group.removeEventListener("keydown", onKey);
  });
  return ref;
}
