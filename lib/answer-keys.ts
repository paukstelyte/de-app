// What counts as "continue" after an answer, and where arrow keys move focus. No imports, so Node tests load it.

export const ADVANCE_DELAY_MS = 1500; // a correct answer stays this long, then the next question appears

// Clicks on these keep doing their own thing (Restart, the level picker, links, text fields).
const OWN_ACTION = "a, button, input, textarea, select, label, [role=button]";

export function clickContinues(target: { closest(selector: string): unknown } | null): boolean {
  return !target?.closest(OWN_ACTION);
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
  for (let k = 1; k <= n; k++) {
    const i = (((current + step * k) % n) + n) % n;
    if (enabled[i] && i !== current) return i;
  }
  return current;
}
