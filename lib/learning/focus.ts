// "Your focus now": the topics from recent uploads, combined, plus the
// learner's own additions and removals. Type-only import, so Node can load it.
import type { Suggestion } from "./suggestions";

export const FOCUS_DAYS = 30;
export type FocusDoc = { id: number; title: string; createdAt: string; topics: Suggestion[] };
export type FocusOverride = { slug: string; kind: "added" | "removed"; updatedAt: string };
export type FocusItem = { slug: string; mistakes: number; documents: number; since: string; fromTitle: string | null; added: boolean };

export function buildFocus(docs: FocusDoc[], overrides: FocusOverride[], now: Date): FocusItem[] {
  const cutoff = now.getTime() - FOCUS_DAYS * 24 * 60 * 60 * 1000;
  const recent = docs.filter((d) => Date.parse(d.createdAt) >= cutoff).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const removedAt = new Map(overrides.filter((o) => o.kind === "removed").map((o) => [o.slug, o.updatedAt]));

  const bySlug = new Map<string, FocusItem & { latest: string }>();
  for (const d of recent) {
    for (const t of d.topics) {
      const item = bySlug.get(t.slug) ?? { slug: t.slug, mistakes: 0, documents: 0, since: d.createdAt, fromTitle: d.title, added: false, latest: d.createdAt };
      item.documents += 1;
      item.mistakes += t.fromMistake ? 1 : 0;
      item.latest = d.createdAt;
      bySlug.set(t.slug, item);
    }
  }
  const suggested = [...bySlug.values()]
    .filter((i) => !(removedAt.has(i.slug) && removedAt.get(i.slug)! >= i.latest))
    .sort((a, b) => b.mistakes - a.mistakes || b.documents - a.documents || b.latest.localeCompare(a.latest))
    .map((i) => { const { latest, ...item } = i; void latest; return item; });

  const added = overrides
    .filter((o) => o.kind === "added" && !bySlug.has(o.slug))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((o) => ({ slug: o.slug, mistakes: 0, documents: 0, since: o.updatedAt, fromTitle: null, added: true }));
  return [...suggested, ...added];
}
