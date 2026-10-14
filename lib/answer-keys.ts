// What counts as "continue" after an answer, and where arrow keys move focus. No imports, so Node tests load it.

export const ADVANCE_DELAY_MS = 1500; // by default a correct answer stays this long, then the next question appears

/** What the learner can choose for moving on after a correct answer (saved per browser). */
export const ADVANCE_CHOICES = { "1500": "after 1.5 seconds", "3000": "after 3 seconds", off: "when I click or press Enter" } as const;
export type AdvanceChoice = keyof typeof ADVANCE_CHOICES;

/** The saved choice, or the default for a missing or unknown value. */
export function advanceChoice(stored: string | null): AdvanceChoice {
  return stored !== null && Object.hasOwn(ADVANCE_CHOICES, stored) ? (stored as AdvanceChoice) : "1500";
}

/** Milliseconds before a correct answer moves on by itself, or null to wait for a click or Enter. */
export const advanceDelay = (choice: AdvanceChoice): number | null => (choice === "off" ? null : Number(choice));

// Clicks on these keep doing their own thing (Restart, the level picker, links, text fields).
const OWN_ACTION = "a, button, input, textarea, select, label, [role=button]";

/** `hasSelection`: the person just selected text with the mouse, which is not a "continue". */
export function clickContinues(target: { closest(selector: string): unknown } | null, hasSelection = false): boolean {
  return !hasSelection && !target?.closest(OWN_ACTION);
}

/** Enter continues, except on a focused button or link (they act on Enter themselves) or an editable field. */
export function keyContinues(
  e: { key: string; repeat: boolean },
  focused: { tagName: string; readOnly?: boolean; isContentEditable?: boolean } | null,
): boolean {
  if (e.key !== "Enter" || e.repeat) return false;
  if (!focused) return true;
  const tag = focused.tagName;
  if (tag === "BUTTON" || tag === "A" || tag === "SELECT") return false;
  if ((tag === "INPUT" || tag === "TEXTAREA") && !focused.readOnly) return false;
  return !focused.isContentEditable;
}

/** The next enabled index after `current` in direction `step`, wrapping; `current` if none other is enabled. */
export function nextEnabled(current: number, enabled: boolean[], step: 1 | -1): number {
  const n = enabled.length;
  const from = current < 0 ? (step > 0 ? -1 : n) : current; // nothing focused: → starts at the first, ← at the last
  for (let k = 1; k <= n; k++) {
    const i = (((from + step * k) % n) + n) % n;
    if (enabled[i] && i !== current) return i;
  }
  return current;
}
