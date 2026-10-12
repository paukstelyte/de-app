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
export function checkRow(row, { rulesById, existingNouns, ranks, wiktionary, newRuleIds = new Set() }) {
  const blocks = [];
  const flags = [];
  const rule = rulesById.get(row.ruleId);
  if (!["der", "die", "das"].includes(row.article)) blocks.push(`bad article "${row.article}"`);
  if (!NEW_LEVELS.has(row.level)) blocks.push(`bad level "${row.level}"`);
  if (row.level === "B2" && !newRuleIds.has(row.ruleId)) blocks.push("B2 is only for the six new rules");
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

export const REVIEW_HEADERS = ["noun", "article", "ruleId", "level", "exception", "reason", "wiktionary", "rank", "problems", "status", "decision", "note"];

/** Carries the owner's decision and note over from the previous review.csv, by noun. */
export function mergeDecisions(newRows, oldRows) {
  const old = new Map(oldRows.map((r) => [r.noun.toLowerCase(), r]));
  return newRows.map((r) => {
    const prev = old.get(r.noun.toLowerCase());
    return prev ? { ...r, decision: prev.decision ?? "", note: prev.note ?? "" } : r;
  });
}

const DECISIONS = new Set(["keep", "drop", "B2", "C1", "C2"]);
const MIN_WORDS_PER_NEW_RULE = 3;

/** Approved review rows → new seed and rules. Existing cards are never changed; new ids continue
 * after the highest existing id; a noun already in the seed is skipped (so a re-run adds nothing);
 * a new rule ships only with at least 3 words, otherwise it and its words are left out. */
export function applyReview(seed, rules, newRules, rows) {
  const problems = [];
  rows.forEach((row, i) => {
    const where = `row ${i + 2} (${row.noun})`;
    if (!DECISIONS.has(row.decision)) problems.push(`${where}: decision must be keep, drop, B2, C1 or C2`);
    else if (row.decision !== "drop" && row.status !== "ok") problems.push(`${where}: blocked rows can only be dropped`);
  });
  if (problems.length) throw new Error(problems.join("\n"));

  const existingRuleIds = new Set(rules.map((rule) => rule.id));
  const known = new Set(seed.map((c) => c.noun.toLowerCase()));
  const approved = rows.filter((row) => row.decision !== "drop" && !known.has(row.noun.toLowerCase()));
  const wordsPerRule = new Map();
  for (const row of approved) wordsPerRule.set(row.ruleId, (wordsPerRule.get(row.ruleId) ?? 0) + 1);
  const shippedNewRules = newRules.filter(
    (rule) => !existingRuleIds.has(rule.id) && (wordsPerRule.get(rule.id) ?? 0) >= MIN_WORDS_PER_NEW_RULE,
  );
  const usable = new Set([...existingRuleIds, ...shippedNewRules.map((rule) => rule.id)]);

  let next = Math.max(...seed.map((c) => Number(c.id.slice("seed-".length)))) + 1;
  const added = [];
  for (const row of approved) {
    if (!usable.has(row.ruleId) || known.has(row.noun.toLowerCase())) continue;
    known.add(row.noun.toLowerCase());
    added.push({
      id: `seed-${next++}`, noun: row.noun, article: row.article, exception: row.exception,
      ruleId: row.ruleId, level: row.decision === "keep" ? row.level : row.decision,
    });
  }
  return { seed: [...seed, ...added], rules: [...rules, ...shippedNewRules], added: added.length };
}
