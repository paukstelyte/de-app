// Pure checks for C1/C2 candidate words; check.mjs and apply.mjs do the file and network work.
const ARTICLE_BY_GENUS = { m: "der", f: "die", n: "das" };
const NEW_LEVELS = new Set(["B2", "C1", "C2"]);
export const COMMON_RANK = 5000; // within the top 5,000 spoken words → "maybe B2 or lower"

/** The article German Wiktionary gives for a noun, from the page's wikitext. Only the German
 * section counts. Two genders (der/die Leiter), plural-only (Genus=0) or none → null. */
export function articleFromWikitext(wikitext) {
  const start = wikitext.indexOf("{{Sprache|Deutsch}}");
  if (start < 0) return { article: null, reason: "no German entry" };
  const next = wikitext.indexOf("{{Sprache|", start + 1);
  const section = wikitext.slice(start, next < 0 ? undefined : next);
  const genders = new Set([...section.matchAll(/\|Genus(?: \d)?=([mfn0])/g)].map((m) => m[1]));
  if (genders.has("0")) return { article: null, reason: "plural only" };
  if (genders.size === 0) return { article: null, reason: "no gender found" };
  if (genders.size > 1) return { article: null, reason: "more than one gender" };
  return { article: ARTICLE_BY_GENUS[[...genders][0]], reason: "" };
}

/** "word count" lines (most frequent first) → lowercase word → 1-based rank. */
export function frequencyRanks(text) {
  const ranks = new Map();
  text.split(/\r?\n/).forEach((line, i) => {
    const word = line.split(" ")[0];
    if (word && !ranks.has(word)) ranks.set(word, i + 1);
  });
  return ranks;
}

function fitsRule(noun, rule) {
  const n = noun.toLowerCase();
  return rule.suffixes.some((s) =>
    s.startsWith("-") ? n.endsWith(s.slice(1).toLowerCase()) : n.startsWith(s.slice(0, -1).toLowerCase()),
  );
}

/** Blocks (status "blocked") stop a word; flags (frequency) only inform the review. */
export function checkRow(row, { rulesById, existingNouns, ranks, wiktionary }) {
  const blocks = [];
  const flags = [];
  const rule = rulesById.get(row.ruleId);
  if (!["der", "die", "das"].includes(row.article)) blocks.push(`bad article "${row.article}"`);
  if (!NEW_LEVELS.has(row.level)) blocks.push(`bad level "${row.level}"`);
  if (!rule) blocks.push(`unknown rule "${row.ruleId}"`);
  if (!wiktionary.article) blocks.push(`Wiktionary: ${wiktionary.reason}`);
  else if (wiktionary.article !== row.article) blocks.push(`Wiktionary says ${wiktionary.article}`);
  if (existingNouns.has(row.noun.toLowerCase())) blocks.push("duplicate (already in the deck or earlier in the sheet)");
  if (rule?.matchType === "suffix" && !fitsRule(row.noun, rule)) blocks.push(`doesn't end with ${rule.suffixes.join(" / ")}`);
  if (rule && rule.article !== row.article && !row.exception) blocks.push("goes against its rule but has no exception text");
  const rank = ranks.get(row.noun.toLowerCase()) ?? null;
  if (rank === null) flags.push("rare: check it isn't obscure");
  else if (rank <= COMMON_RANK) flags.push("common: maybe B2 or lower");
  return { status: blocks.length ? "blocked" : "ok", problems: [...blocks, ...flags].join("; "), rank };
}
