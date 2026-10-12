// How many uploads and saved documents a learner has left, and when the next upload frees up.
// No imports, so Node tests load it.

// Keep in sync with the learning_documents_limit trigger in the database (migration 20261010100000).
export const MAX_DOCUMENTS = 200;

export type Allowance = { userLeft: number; userLimit: number; sharedLeft: number; nextFreeAt: string | null; documents: number };

/** The one row `upload_allowance()` returns, plus the learner's saved-document count. Null if the row looks wrong. */
export function parseAllowance(data: unknown, documents: number): Allowance | null {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
  const n = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);
  const userLeft = n(row?.user_left), userLimit = n(row?.user_limit), sharedLeft = n(row?.shared_left);
  if (userLeft === null || userLimit === null || sharedLeft === null || userLimit === 0) return null;
  const free = typeof row?.next_free_at === "string" && !Number.isNaN(Date.parse(row.next_free_at)) ? row.next_free_at : null;
  return { userLeft, userLimit, sharedLeft, nextFreeAt: free, documents };
}

/** "at 14:20" for later today, "tomorrow at 02:15" otherwise (the reader's own clock). */
export function freeAtLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const sameDay = at.toDateString() === now.toDateString();
  return sameDay ? `at ${time}` : `tomorrow at ${time}`;
}
