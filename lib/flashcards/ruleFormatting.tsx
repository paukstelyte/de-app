import type { ReactNode } from "react";
import rules from "./data/rules.json";

interface RuleLike {
  suffixes?: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ALL_SUFFIXES = Array.from(
  new Set((rules as RuleLike[]).flatMap((rule) => rule.suffixes ?? [])),
).sort((a, b) => b.length - a.length);

const PATTERN = ALL_SUFFIXES.length
  ? new RegExp(`(${ALL_SUFFIXES.map(escapeRegExp).join("|")})`, "i")
  : null;

/** Bolds the suffix/prefix (e.g. "-ung", "Ge-") a rule's explanation hinges
 * on, wherever it's mentioned in the text — used on both the flashcard's
 * rule text and the Rules reference page so the pattern being taught is
 * easy to spot at a glance. */
export function formatRuleText(text: string): ReactNode {
  if (!PATTERN || !text) return text;
  return text
    .split(PATTERN)
    .map((part, index) =>
      index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
    );
}
