"use client";

import { ADVANCE_CHOICES, type AdvanceChoice } from "@/lib/answer-keys";
import { useAdvanceChoice } from "@/lib/useAdvance";

/** "After a correct answer, go on: after 1.5 seconds / after 3 seconds / when I click or press Enter". */
export function AdvanceSetting() {
  const [choice, setChoice] = useAdvanceChoice();
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
      After a correct answer, go on
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value as AdvanceChoice)}
        className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200"
      >
        {Object.entries(ADVANCE_CHOICES).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}
