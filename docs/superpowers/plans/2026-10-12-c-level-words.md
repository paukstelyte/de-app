# C1/C2 words for der · die · das Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add about 150 C1 and 100 C2 nouns (plus six new rules) to the der · die · das deck, and change the level picker to A · B · C · All with a visible level badge on every card.

**Architecture:** A committed pipeline in `scripts/c-levels/` turns a hand-written candidate sheet into a checked review sheet (Wiktionary article check, rule fit, duplicates, frequency flags), which the owner approves; `apply.mjs` then appends approved words to `lib/flashcards/data/seed.json` and the new rules to `rules.json`. The app change is small: six levels in the data, a band filter and band storage, and the picker and card badge in `ArticlesGame.tsx`.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind 4, Node's built-in test runner (`node --test`, tests are `.test.mjs` importing `.ts`/`.mjs` directly), playwright-cli for browser checks. No new packages.

**Spec:** `docs/superpowers/specs/2026-10-12-c-level-words-design.md`

## Global Constraints

- No new npm packages (CLAUDE.md "Do Not"). The CSV handling is a small hand-written module.
- Existing card ids are never changed and removed ids are never reused. The highest existing id is `seed-995`; new ids start at `seed-996`.
- The original 976 cards are not edited in any field.
- New card levels are only `B2`, `C1` or `C2`. B2 words are only for the six new rules.
- Word bar: educated advanced everyday German (news, essays, work, public life). No jargon, slang, archaic or narrow technical words.
- Every card has a `ruleId` from `rules.json`. No rule-less words.
- Wiktionary: at most one request per second, with a User-Agent naming the project; answers cached in `scripts/c-levels/wiktionary-cache.json`.
- The frequency list is `de_50k.txt` from hermitdave/FrequencyWords (OpenSubtitles 2018, CC BY-SA 4.0), stored with its source and license noted.
- Picker bands: A = A1+A2, B = B1+B2, C = C1+C2, plus All. **All is the default.** "Practise my mistakes" ignores the band.
- Old saved choice (localStorage `de-app:max-level`): A1 or A2 → A, B1 → B, B2 → All.
- Work happens on branch `feature/c-level-words`. Two PRs (PR 1: Tasks 1–4; PR 2: Tasks 5–10). Each PR: `ai-code-reviewer` report in `docs/reviews/`, `/security-scan-changed`, suggested usability tests. No merge, push or live change without the owner.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Old or junk saved levels** (`"A1"`, `"B2"`, `"Z9"`, missing, blocked storage) must map to a valid band, never crash the game. Pinned in Task 6.
- **Wiktionary edge cases**: a missing page, a page with no German section, a noun with two genders (der/die Leiter) or plural-only must block the word, never pass it. Pinned in Task 1.
- **Commas, quotes and line breaks in exception text** must survive the CSV round trip unchanged (51 existing exceptions contain commas). Pinned in Task 1.
- **The owner's sheet saved from Excel or Numbers** (`\r\n` line endings, a byte-order mark, stray blank lines) must still parse, and re-running `check.mjs` must keep the owner's decisions. Pinned in Tasks 1 and 3.
- **Running `apply.mjs` twice** must not add cards twice or shift ids. Pinned in Task 5.

---

## PR 1: pipeline and review sheet

### Task 1: CSV module and word-check logic

**Files:**
- Create: `scripts/c-levels/csv.mjs`
- Create: `scripts/c-levels/lib.mjs`
- Test: `scripts/c-levels/lib.test.mjs`
- Modify: `package.json` (the `test` script also runs `scripts/**/*.test.mjs`)

**Interfaces:**
- Produces: `parseCsv(text: string): Record<string,string>[]`, `toCsv(rows: object[], headers: string[]): string` (csv.mjs); `articleFromWikitext(wikitext: string): { article: "der"|"die"|"das"|null, reason: string }`, `frequencyRanks(text: string): Map<string, number>`, `checkRow(row, ctx): { status: "ok"|"blocked", problems: string, rank: number|null }`, `COMMON_RANK = 5000` (lib.mjs). `row` has `noun, article, ruleId, level, exception`. `ctx` is `{ rulesById: Map<string, Rule>, existingNouns: Set<string> (lowercase), ranks: Map<string, number>, wiktionary: { article, reason } }`.

- [ ] **Step 1: Write the failing tests**

```js
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, toCsv } from "./csv.mjs";
import { articleFromWikitext, checkRow, frequencyRanks, COMMON_RANK } from "./lib.mjs";

test("CSV round trip keeps commas, quotes and line breaks", () => {
  const rows = [{ noun: "Nomade", exception: 'A person, so "der", not die\nsee -ade' }];
  assert.deepEqual(parseCsv(toCsv(rows, ["noun", "exception"])), rows);
});

test("CSV from Excel/Numbers: BOM, \\r\\n and blank lines", () => {
  const text = "﻿noun,level\r\nFassade,C1\r\n\r\nParade,B2\r\n";
  assert.deepEqual(parseCsv(text), [{ noun: "Fassade", level: "C1" }, { noun: "Parade", level: "B2" }]);
  assert.deepEqual(parseCsv(""), []);
});

const page = (body) => `== Reportage ({{Sprache|Deutsch}}) ==\n${body}\n== X ({{Sprache|Englisch}}) ==\n|Genus=m`;

test("Wiktionary: one gender gives the article; anything else blocks", () => {
  assert.deepEqual(articleFromWikitext(page("{{Deutsch Substantiv Übersicht\n|Genus=f")), { article: "die", reason: "" });
  assert.equal(articleFromWikitext(page("|Genus 1=m\n|Genus 2=f")).article, null); // der/die Leiter
  assert.equal(articleFromWikitext(page("|Genus=0")).reason, "plural only");
  assert.equal(articleFromWikitext("== x ({{Sprache|Englisch}}) ==\n|Genus=m").reason, "no German entry");
  assert.equal(articleFromWikitext("").reason, "no German entry");
  assert.equal(articleFromWikitext(page("no template")).reason, "no gender found");
});

test("frequency ranks are 1-based, first occurrence wins", () => {
  const ranks = frequencyRanks("ich 100\nteppich 50\nich 3\n");
  assert.equal(ranks.get("ich"), 1);
  assert.equal(ranks.get("teppich"), 2);
});

const rulesById = new Map([
  ["die-age", { id: "die-age", article: "die", matchType: "suffix", suffixes: ["-age"] }],
  ["das-ge-prefix", { id: "das-ge-prefix", article: "das", matchType: "suffix", suffixes: ["ge-"] }],
  ["der-male-persons", { id: "der-male-persons", article: "der", matchType: "semantic" }],
]);
const ctx = (over = {}) => ({ rulesById, existingNouns: new Set(["garage"]), ranks: new Map([["reportage", 20412], ["etage", 900]]), wiktionary: { article: "die", reason: "" }, ...over });
const row = (over = {}) => ({ noun: "Reportage", article: "die", ruleId: "die-age", level: "C1", exception: "", ...over });

test("a good row passes; frequency only flags", () => {
  assert.deepEqual(checkRow(row(), ctx()), { status: "ok", problems: "", rank: 20412 });
  assert.match(checkRow(row({ noun: "Etage" }), ctx()).problems, /common/);
  assert.equal(checkRow(row({ noun: "Etage" }), ctx()).status, "ok");
  assert.match(checkRow(row({ noun: "Sabotage" }), ctx()).problems, /rare/);
  assert.ok(COMMON_RANK > 0);
});

test("blocks: wrong or missing Wiktionary gender, duplicate, bad rule fit, bad level", () => {
  const blocked = (r, c) => checkRow(row(r), ctx(c));
  assert.match(blocked({}, { wiktionary: { article: "der", reason: "" } }).problems, /Wiktionary says der/);
  assert.match(blocked({}, { wiktionary: { article: null, reason: "more than one gender" } }).problems, /more than one gender/);
  assert.match(blocked({ noun: "Garage" }).problems, /duplicate/);
  assert.match(blocked({ noun: "Fassade" }).problems, /doesn't end with -age/);
  assert.match(blocked({ level: "A2" }).problems, /bad level/);
  assert.match(blocked({ ruleId: "nope" }).problems, /unknown rule/);
  assert.equal(blocked({ noun: "Fassade" }).status, "blocked");
});

test("prefix rules match the start; going against a rule needs exception text", () => {
  const ge = row({ noun: "Gebirge", article: "das", ruleId: "das-ge-prefix" });
  assert.equal(checkRow(ge, ctx({ wiktionary: { article: "das", reason: "" } })).status, "ok");
  const against = row({ noun: "Nomage", article: "der" });
  assert.match(checkRow(against, ctx({ wiktionary: { article: "der", reason: "" } })).problems, /no exception text/);
  const explained = row({ noun: "Nomage", article: "der", exception: "A person." });
  assert.equal(checkRow(explained, ctx({ wiktionary: { article: "der", reason: "" } })).status, "ok");
});
```

- [ ] **Step 2: Add the scripts folder to `npm test`, run, see it fail**

In `package.json`, change the `test` script to:
```json
"test": "node --no-warnings --test \"lib/**/*.test.mjs\" \"scripts/**/*.test.mjs\""
```
Run: `npm test` → FAIL: `Cannot find module '.../scripts/c-levels/csv.mjs'`.

- [ ] **Step 3: Implement `scripts/c-levels/csv.mjs`**

```js
// Minimal CSV for the review sheets (no package): quoted fields may hold commas, "" quotes
// and line breaks. Tolerates a byte-order mark, \r\n and blank lines (Excel / Numbers).
export function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((f) => f.trim() !== ""));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, k) => [h.trim(), (r[k] ?? "").trim()])));
}

export function toCsv(rows, headers) {
  const cell = (v) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\n") + "\n";
}
```

- [ ] **Step 4: Implement `scripts/c-levels/lib.mjs`**

```js
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
```

- [ ] **Step 5: Run the tests**

Run: `npm test` → all pass (129 existing + the new ones). Then `npx tsc --noEmit && npm run lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/c-levels/csv.mjs scripts/c-levels/lib.mjs scripts/c-levels/lib.test.mjs
git commit -m "Add CSV and word-check logic for the C1/C2 pipeline"
```

### Task 2: Six new rules and the frequency list

**Files:**
- Create: `scripts/c-levels/new-rules.json`
- Create: `scripts/c-levels/de_50k.txt` (downloaded)
- Create: `scripts/c-levels/README.md`

**Interfaces:**
- Produces: `new-rules.json`, an array of rules in the same shape as `lib/flashcards/data/rules.json` entries (`id, article, title, matchType: "suffix", suffixes, description, examples, exceptions` where each exception is `{ noun, article, note }`; no `category`). Rule ids: `der-ist`, `der-ast`, `der-ich-ig`, `die-age`, `die-ade`, `die-ette`.

- [ ] **Step 1: Download the frequency list**

```bash
curl -sSf -o scripts/c-levels/de_50k.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt
wc -l scripts/c-levels/de_50k.txt   # expect 50000
```

- [ ] **Step 2: Write `scripts/c-levels/new-rules.json`**

Starting draft (the reviewer in Task 4 checks every sentence; fix anything it finds):

```json
[
  { "id": "der-ist", "article": "der", "title": "People ending in -ist", "matchType": "suffix", "suffixes": ["-ist"],
    "description": "Nouns ending in -ist name a person by their views, field or job (Optimist, Journalist, Pianist). As words for male or mixed people they are masculine; the female form adds -in (die Journalistin).",
    "examples": ["Journalist", "Optimist", "Spezialist", "Pianist", "Realist", "Egoist", "Polizist", "Tourist"],
    "exceptions": [{ "noun": "die List", "article": "die", "note": "Means cunning or a trick, not a person, so the -ist person rule doesn't apply." }] },
  { "id": "der-ast", "article": "der", "title": "Nouns of more than one syllable ending in -ast", "matchType": "suffix", "suffixes": ["-ast"],
    "description": "Nouns of more than one syllable ending in -ast are masculine (der Kontrast, der Palast, der Enthusiast). Short one-syllable words are the trap: die Last, die Rast, die Hast.",
    "examples": ["Kontrast", "Palast", "Ballast", "Enthusiast", "Gymnasiast", "Fantast"],
    "exceptions": [{ "noun": "die Last", "article": "die", "note": "A one-syllable word (load, burden); the rule is for longer -ast nouns." }] },
  { "id": "der-ich-ig", "article": "der", "title": "Nouns ending in -ich and -ig", "matchType": "suffix", "suffixes": ["-ich", "-ig"],
    "description": "Nouns ending in -ich or -ig are almost always masculine (der Teppich, der Kranich, der Essig, der Käfig). Don't confuse -ich with -icht, which is neuter (das Dickicht).",
    "examples": ["Teppich", "Kranich", "Rettich", "Essig", "Honig", "Käfig"],
    "exceptions": [{ "noun": "das Reisig", "article": "das", "note": "Brushwood: a rare neuter exception to the -ig rule." }] },
  { "id": "die-age", "article": "die", "title": "Nouns ending in -age", "matchType": "suffix", "suffixes": ["-age"],
    "description": "Nouns ending in -age, mostly from French and pronounced the French way (-ahsche), are feminine: die Reportage, die Blamage, die Garage.",
    "examples": ["Reportage", "Blamage", "Sabotage", "Garage", "Etage", "Passage"],
    "exceptions": [] },
  { "id": "die-ade", "article": "die", "title": "Nouns ending in -ade", "matchType": "suffix", "suffixes": ["-ade"],
    "description": "Nouns ending in -ade are feminine: die Fassade, die Blockade, die Parade. Words for people are the exception: der Nomade.",
    "examples": ["Fassade", "Blockade", "Parade", "Ballade", "Olympiade"],
    "exceptions": [{ "noun": "der Nomade", "article": "der", "note": "A word for a (male) person, so masculine like other person nouns." }] },
  { "id": "die-ette", "article": "die", "title": "Nouns ending in -ette", "matchType": "suffix", "suffixes": ["-ette"],
    "description": "Nouns ending in -ette are feminine: die Silhouette, die Etikette, die Tablette. Don't confuse it with -ett without the final e, which is often neuter (das Ballett, das Kabinett).",
    "examples": ["Silhouette", "Etikette", "Tablette", "Toilette", "Serviette", "Kassette"],
    "exceptions": [] }
]
```

- [ ] **Step 3: Write `scripts/c-levels/README.md`**

```markdown
# C1/C2 words for der · die · das

How the C1/C2 cards were made (design: `docs/superpowers/specs/2026-10-12-c-level-words-design.md`).

1. `candidates.csv`: hand-written candidates (`noun,article,ruleId,level,exception,reason`).
2. `node scripts/c-levels/check.mjs`: checks each word against German Wiktionary (cached in
   `wiktionary-cache.json`, one request a second), its rule, the existing deck and the frequency
   list, and writes `review.csv` (problem rows first). Re-running keeps the `decision` and `note`
   columns.
3. An independent reviewer checks every row; then the owner fills `decision` with keep, drop,
   B2, C1 or C2.
4. `node scripts/c-levels/apply.mjs`: adds approved words to `lib/flashcards/data/seed.json`
   (ids from `seed-996`) and each new rule with at least 3 approved words to `rules.json`.
   Running it twice changes nothing.

`de_50k.txt`: the 50,000 most frequent words in German film subtitles, from
https://github.com/hermitdave/FrequencyWords (OpenSubtitles 2018), licensed CC BY-SA 4.0.
Used only to flag words that look too common or too rare; it favours spoken language.
```

- [ ] **Step 4: Validate the JSON and commit**

Run: `node -e 'const r=require("./scripts/c-levels/new-rules.json");if(r.length!==6)throw 1;console.log(r.map(x=>x.id).join(" "))'` → prints the six ids.

```bash
git add scripts/c-levels/new-rules.json scripts/c-levels/de_50k.txt scripts/c-levels/README.md
git commit -m "Add the six new rules (draft) and the frequency list for C1/C2 words"
```

### Task 3: `check.mjs` (Wiktionary lookups and the review sheet)

**Files:**
- Create: `scripts/c-levels/check.mjs`
- Create (generated): `scripts/c-levels/wiktionary-cache.json`, `scripts/c-levels/review.csv`
- Test: `scripts/c-levels/lib.test.mjs` (add `mergeDecisions`)
- Modify: `scripts/c-levels/lib.mjs` (add `mergeDecisions`)

**Interfaces:**
- Consumes: `parseCsv`, `toCsv`, `articleFromWikitext`, `frequencyRanks`, `checkRow` (Task 1); `new-rules.json`, `de_50k.txt` (Task 2).
- Produces: `review.csv` with headers `REVIEW_HEADERS = ["noun","article","ruleId","level","exception","reason","wiktionary","rank","problems","status","decision","note"]` (exported from lib.mjs); `mergeDecisions(newRows, oldRows)` keeps `decision`/`note` by noun.

- [ ] **Step 1: Failing test for keeping the owner's decisions**

Add to `lib.test.mjs` (and add `mergeDecisions, REVIEW_HEADERS` to the import from `./lib.mjs`):
```js
test("re-running the check keeps the owner's decision and note", () => {
  const fresh = [{ noun: "Fassade", status: "ok", decision: "", note: "" }, { noun: "Parade", status: "ok", decision: "", note: "" }];
  const old = [{ noun: "Fassade", decision: "C1", note: "fine" }];
  assert.deepEqual(mergeDecisions(fresh, old), [
    { noun: "Fassade", status: "ok", decision: "C1", note: "fine" },
    { noun: "Parade", status: "ok", decision: "", note: "" },
  ]);
  assert.equal(REVIEW_HEADERS.at(-2), "decision");
});
```
Run `npm test` → FAIL (`mergeDecisions` is not exported).

- [ ] **Step 2: Implement in `lib.mjs`**

```js
export const REVIEW_HEADERS = ["noun", "article", "ruleId", "level", "exception", "reason", "wiktionary", "rank", "problems", "status", "decision", "note"];

/** Carries the owner's decision and note over from the previous review.csv, by noun. */
export function mergeDecisions(newRows, oldRows) {
  const old = new Map(oldRows.map((r) => [r.noun.toLowerCase(), r]));
  return newRows.map((r) => {
    const prev = old.get(r.noun.toLowerCase());
    return prev ? { ...r, decision: prev.decision ?? "", note: prev.note ?? "" } : r;
  });
}
```
Run `npm test` → pass.

- [ ] **Step 3: Write `scripts/c-levels/check.mjs`**

```js
// Builds review.csv from candidates.csv: Wiktionary article, rule fit, duplicates, frequency.
// Run: node scripts/c-levels/check.mjs   (Wiktionary answers are cached in wiktionary-cache.json)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseCsv, toCsv } from "./csv.mjs";
import { articleFromWikitext, checkRow, frequencyRanks, mergeDecisions, REVIEW_HEADERS } from "./lib.mjs";

const here = (f) => new URL(f, import.meta.url);
const read = (f) => readFileSync(here(f), "utf8");
const seed = JSON.parse(read("../../lib/flashcards/data/seed.json"));
const rules = [...JSON.parse(read("../../lib/flashcards/data/rules.json")), ...JSON.parse(read("new-rules.json"))];
const rulesById = new Map(rules.map((r) => [r.id, r]));
const ranks = frequencyRanks(read("de_50k.txt"));
const cachePath = here("wiktionary-cache.json");
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};

async function lookup(noun) {
  if (cache[noun]) return cache[noun];
  await new Promise((resolve) => setTimeout(resolve, 1000)); // at most one request a second
  const url = `https://de.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(noun)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": "DE-app word check (https://github.com/paukstelyte/de-app)" } });
  if (!res.ok) throw new Error(`Wiktionary answered ${res.status} for ${noun}; re-run later (finished lookups are cached)`);
  const json = await res.json();
  cache[noun] = articleFromWikitext(json.parse?.wikitext ?? ""); // a missing page has no wikitext
  writeFileSync(cachePath, JSON.stringify(cache, null, 1) + "\n");
  return cache[noun];
}

const seen = new Set(seed.map((c) => c.noun.toLowerCase()));
const rows = [];
for (const row of parseCsv(read("candidates.csv"))) {
  const wiktionary = await lookup(row.noun);
  const { status, problems, rank } = checkRow(row, { rulesById, existingNouns: seen, ranks, wiktionary });
  seen.add(row.noun.toLowerCase());
  rows.push({ ...row, wiktionary: wiktionary.article ?? "", rank: rank ?? "", problems, status, decision: "", note: "" });
}
rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "blocked" ? -1 : 1));
const reviewPath = here("review.csv");
const old = existsSync(reviewPath) ? parseCsv(readFileSync(reviewPath, "utf8")) : [];
writeFileSync(reviewPath, toCsv(mergeDecisions(rows, old), REVIEW_HEADERS));

const count = (pred) => rows.filter(pred).length;
console.log(`${rows.length} rows: ${count((r) => r.status === "ok")} ok, ${count((r) => r.status === "blocked")} blocked`);
for (const level of ["B2", "C1", "C2"]) console.log(`  ${level}: ${count((r) => r.level === level && r.status === "ok")} ok`);
```

- [ ] **Step 4: Smoke-test with three rows**

Create `scripts/c-levels/candidates.csv`:
```csv
noun,article,ruleId,level,exception,reason
Reportage,die,die-age,C1,,news and media register
Fassade,die,die-age,C1,,deliberately wrong rule to prove blocking
Leiter,der,der-agent-er,C1,,two genders on Wiktionary
```
Run: `node scripts/c-levels/check.mjs` → `3 rows: 1 ok, 2 blocked`. Open `review.csv`: Fassade has "doesn't end with -age"; Leiter has "Wiktionary: more than one gender". Run it again: it finishes at once (cached), and a `decision` typed into `review.csv` before the re-run is still there. Commit the code and cache only:

```bash
git add scripts/c-levels/lib.mjs scripts/c-levels/lib.test.mjs scripts/c-levels/check.mjs
git commit -m "Add the C1/C2 check script: Wiktionary article, rule fit, duplicates, frequency"
```
(The three-row `candidates.csv`, `review.csv` and cache are replaced in Task 4.)

### Task 4: Candidates, independent review, and PR 1

**Files:**
- Create: `scripts/c-levels/candidates.csv` (about 300 rows)
- Create (generated): `scripts/c-levels/review.csv`, `scripts/c-levels/wiktionary-cache.json`
- Modify: `scripts/c-levels/new-rules.json` (reviewer fixes)
- Create: `docs/reviews/pr-<n>-c-level-words-pipeline.md`

**Interfaces:**
- Consumes: `check.mjs` (Task 3), `new-rules.json` (Task 2).
- Produces: `review.csv` ready for the owner (every row `ok`, or blocked with a `note` saying why it stays for the owner to drop).

- [ ] **Step 1: Write about 300 candidates**

Columns `noun,article,ruleId,level,exception,reason`. Targets: about 180 C1 and 120 C2 candidates (expecting drops to about 150 and 100), plus up to 30 B2 words for the six new rules only. Spread over the rules with real C-level vocabulary (3–10 per rule): the suffix rules first (`die-ung`, `die-heit-keit`, `die-schaft`, `die-tion-sion`, `die-taet`, `die-enz-anz`, `die-ik`, `die-ie`, `die-ur`, `der-ismus`, `der-or`, `der-ant-and`, `der-ling`, `das-um`, `das-ment`, `das-tum`, `das-nis-sal`, `das-ge-prefix`, `das-ma`, `das-icht`) and the six new ones. The `reason` names the register in a few words ("academic", "legal and administrative", "news and politics", "literary"). Exception text, where a word goes against its rule, follows the existing style: one or two sentences saying why.

- [ ] **Step 2: Run the check and fix blocks**

Run: `node scripts/c-levels/check.mjs` (about 5 minutes the first time). For each blocked row: fix the article if Wiktionary is right, fix the rule, or remove the row. Keep a blocked row only if it is worth the owner's decision, with a `note` saying why. Re-run until it prints no unexplained blocks.

- [ ] **Step 3: Independent review**

Dispatch a reviewer agent on the most capable model with `review.csv` and `new-rules.json`: check every row's article, that the word is natural current German at the stated level (not jargon, slang, archaic or narrow technical), the rule fit, and every exception text; and every sentence of the six rules. Fix every finding in `candidates.csv` / `new-rules.json`, re-run `check.mjs`, and record the reviewer's summary for the PR.

- [ ] **Step 4: Check the totals**

Run: `node scripts/c-levels/check.mjs` → at least 150 C1 and 100 C2 rows `ok`; every new rule has at least 3 `ok` rows.

- [ ] **Step 5: Commit, review, scan, PR**

```bash
git add scripts/c-levels/candidates.csv scripts/c-levels/review.csv scripts/c-levels/wiktionary-cache.json scripts/c-levels/new-rules.json
git commit -m "Add C1/C2 candidate words and the checked review sheet"
```
Run the `ai-code-reviewer` agent on `main...feature/c-level-words`, save its report as `docs/reviews/pr-<n>-c-level-words-pipeline.md`, fix findings, run `/security-scan-changed`, then (with the owner's OK) push and open PR 1. The PR description asks the owner to fill the `decision` column of `scripts/c-levels/review.csv` (keep, drop, B2, C1 or C2) and explains the columns.

**Owner gate:** PR 2 starts only after the owner has filled every `decision` in `review.csv`.

---

## PR 2: apply and app changes

### Task 5: `apply.mjs`

**Files:**
- Modify: `scripts/c-levels/lib.mjs` (add `applyReview`)
- Test: `scripts/c-levels/lib.test.mjs`
- Create: `scripts/c-levels/apply.mjs`

**Interfaces:**
- Produces: `applyReview(seed, rules, newRules, rows): { seed, rules, added: number }`. Throws an `Error` listing every row with a missing or invalid decision, or a non-drop decision on a blocked row.

- [ ] **Step 1: Failing tests**

Add to `lib.test.mjs` (import `applyReview`):
```js
const seed0 = [
  { id: "seed-0", noun: "Lehrer", article: "der", exception: "", ruleId: "der-agent-er", level: "A1" },
  { id: "seed-995", noun: "Zeitung", article: "die", exception: "", ruleId: "die-ung", level: "A1" },
];
const rules0 = [{ id: "der-agent-er" }, { id: "die-ung" }];
const newRules0 = [{ id: "die-age" }, { id: "die-ette" }];
const r = (noun, decision, over = {}) => ({ noun, article: "die", ruleId: "die-age", level: "C1", exception: "", status: "ok", decision, ...over });
const ageRows = [r("Reportage", "keep"), r("Sabotage", "C2"), r("Blamage", "keep"), r("Passage", "drop")];

test("apply adds approved words from seed-996 and rules with 3+ words", () => {
  const out = applyReview(seed0, rules0, newRules0, ageRows);
  assert.equal(out.added, 3);
  assert.deepEqual(out.seed.slice(2).map((c) => [c.id, c.noun, c.level]), [["seed-996", "Reportage", "C1"], ["seed-997", "Sabotage", "C2"], ["seed-998", "Blamage", "C1"]]);
  assert.deepEqual(out.seed.slice(0, 2), seed0); // existing cards untouched
  assert.deepEqual(out.rules.map((x) => x.id), ["der-agent-er", "die-ung", "die-age"]); // die-ette has no words
});

test("apply twice changes nothing", () => {
  const once = applyReview(seed0, rules0, newRules0, ageRows);
  const twice = applyReview(once.seed, once.rules, newRules0, ageRows);
  assert.deepEqual(twice.seed, once.seed);
  assert.deepEqual(twice.rules, once.rules);
  assert.equal(twice.added, 0);
});

test("apply refuses undecided rows and kept blocked rows", () => {
  assert.throws(() => applyReview(seed0, rules0, newRules0, [r("Reportage", "")]), /Reportage.*decision/);
  assert.throws(() => applyReview(seed0, rules0, newRules0, [r("Reportage", "maybe")]), /decision/);
  assert.throws(() => applyReview(seed0, rules0, newRules0, [r("Fassade", "keep", { status: "blocked" })]), /Fassade.*blocked/);
  assert.equal(applyReview(seed0, rules0, newRules0, [r("Fassade", "drop", { status: "blocked" })]).added, 0);
});

test("a new rule with fewer than 3 words is left out, and so are its words", () => {
  const two = [r("Reportage", "keep"), r("Sabotage", "keep")];
  const out = applyReview(seed0, rules0, newRules0, two);
  assert.equal(out.added, 0);
  assert.deepEqual(out.rules.map((x) => x.id), ["der-agent-er", "die-ung"]);
});
```
Run `npm test` → FAIL (`applyReview` not exported).

- [ ] **Step 2: Implement `applyReview` in `lib.mjs`**

```js
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
```
Run `npm test` → pass.

- [ ] **Step 3: Write `scripts/c-levels/apply.mjs`**

```js
// Applies the owner's decisions in review.csv: appends approved words to seed.json and the new
// rules that have at least 3 words to rules.json. Refuses undecided or kept-blocked rows.
// Run: node scripts/c-levels/apply.mjs   (running it twice changes nothing)
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "./csv.mjs";
import { applyReview } from "./lib.mjs";

const here = (f) => new URL(f, import.meta.url);
const seedPath = here("../../lib/flashcards/data/seed.json");
const rulesPath = here("../../lib/flashcards/data/rules.json");
const read = (u) => JSON.parse(readFileSync(u, "utf8"));
const rows = parseCsv(readFileSync(here("review.csv"), "utf8"));
const out = applyReview(read(seedPath), read(rulesPath), read(here("new-rules.json")), rows);
writeFileSync(seedPath, JSON.stringify(out.seed, null, 2) + "\n");
writeFileSync(rulesPath, JSON.stringify(out.rules, null, 2) + "\n");
console.log(`added ${out.added} cards; seed has ${out.seed.length} cards and ${out.rules.length} rules`);
```

- [ ] **Step 4: Commit**

```bash
git add scripts/c-levels/lib.mjs scripts/c-levels/lib.test.mjs scripts/c-levels/apply.mjs
git commit -m "Add apply.mjs: add approved C1/C2 words and new rules to the deck"
```

### Task 6: Six levels, bands and the remembered choice

**Files:**
- Modify: `lib/flashcards/types.ts:5` (`LEVELS`)
- Create: `lib/flashcards/bands.ts`
- Test: `lib/flashcards/bands.test.mjs`
- Modify: `lib/flashcards/level.ts` (band storage)

**Interfaces:**
- Produces: `BANDS = ["A","B","C","all"] as const`, `type Band`, `BAND_LABELS: Record<Band,string>`, `inBand(level: Level, band: Band): boolean`, `bandFromStorage(saved: string|null, oldSaved: string|null): Band` (bands.ts); `useBand(): [Band, (band: Band) => void]` (level.ts, replacing `useMaxLevel` and `isAtOrBelow`).

- [ ] **Step 1: Failing tests (`lib/flashcards/bands.test.mjs`)**

```js
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { BANDS, inBand, bandFromStorage } from "./bands.ts";

test("each band holds only its own levels; all holds every level", () => {
  assert.equal(inBand("A2", "A"), true);
  assert.equal(inBand("B1", "A"), false);
  assert.equal(inBand("C2", "C"), true);
  assert.equal(inBand("B2", "C"), false);
  for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"]) assert.equal(inBand(level, "all"), true);
  assert.deepEqual([...BANDS], ["A", "B", "C", "all"]);
});

test("a saved band wins; otherwise the old saved level is converted; default is all", () => {
  assert.equal(bandFromStorage("C", "A1"), "C");
  assert.equal(bandFromStorage(null, "A1"), "A");
  assert.equal(bandFromStorage(null, "A2"), "A");
  assert.equal(bandFromStorage(null, "B1"), "B");
  assert.equal(bandFromStorage(null, "B2"), "all"); // old "All (A1–B2)"
  assert.equal(bandFromStorage(null, null), "all");
  assert.equal(bandFromStorage("Z9", "nonsense"), "all"); // junk never crashes
});
```
Run `npm test` → FAIL (no `bands.ts`).

- [ ] **Step 2: `LEVELS` and `bands.ts`**

In `lib/flashcards/types.ts` change line 5 to:
```ts
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
```
Create `lib/flashcards/bands.ts`:
```ts
import type { Level } from "./types";

/** The level picker's choices: each band holds only its own words. */
export const BANDS = ["A", "B", "C", "all"] as const;
export type Band = (typeof BANDS)[number];

export const BAND_LABELS: Record<Band, string> = { A: "A", B: "B", C: "C", all: "All" };

export function inBand(level: Level, band: Band): boolean {
  return band === "all" || level.startsWith(band);
}

// Before bands, the picker saved the highest level: "B2" meant everything (A1–B2).
const FROM_OLD_LEVEL: Record<string, Band> = { A1: "A", A2: "A", B1: "B", B2: "all" };

/** The band to show: the saved band, else the old saved level converted, else All. */
export function bandFromStorage(saved: string | null, oldSaved: string | null): Band {
  if (BANDS.includes(saved as Band)) return saved as Band;
  return (oldSaved && FROM_OLD_LEVEL[oldSaved]) || "all";
}
```
Run `npm test` → pass.

- [ ] **Step 3: Replace `lib/flashcards/level.ts`**

```ts
import { useSyncExternalStore } from "react";
import { bandFromStorage, type Band } from "./bands";

/** The level band a player wants to practise, remembered per browser. */
const STORAGE_KEY = "de-app:level-band";
const OLD_KEY = "de-app:max-level"; // before bands: the highest level, converted on read
const DEFAULT: Band = "all";

const listeners = new Set<() => void>();

function read(): Band {
  try {
    return bandFromStorage(window.localStorage.getItem(STORAGE_KEY), window.localStorage.getItem(OLD_KEY));
  } catch {
    return DEFAULT;
  }
}

export function useBand(): [Band, (band: Band) => void] {
  const band = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => DEFAULT, // server: localStorage doesn't exist
  );
  function setBand(next: Band) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Blocked storage (e.g. private mode): the choice can't be kept, so it stays on "All".
    }
    listeners.forEach((l) => l());
  }
  return [band, setBand];
}
```

- [ ] **Step 4: Type check fails where the old names are used**

Run: `npx tsc --noEmit` → errors in `components/ArticlesGame.tsx` (`useMaxLevel`, `isAtOrBelow`). These are fixed in Task 7; do not commit yet.

### Task 7: Picker and level badge in the game

**Files:**
- Modify: `components/ArticlesGame.tsx` (imports lines 8–9; filter lines 53–58; picker usage near line 147; card label line 350; `LEVEL_OPTIONS` and `LevelPicker` lines 254–275)

**Interfaces:**
- Consumes: `useBand`, `inBand`, `BANDS`, `BAND_LABELS`, `type Band` (Task 6); `LevelBadge` from `components/LevelBadge.tsx` (already supports A1–C2).

- [ ] **Step 1: Imports and filtering**

Replace the imports on lines 8–9 with:
```tsx
import { ARTICLES, getFlashcardStatus, type Article } from "@/lib/flashcards/types";
import { useBand } from "@/lib/flashcards/level";
import { BANDS, BAND_LABELS, inBand, type Band } from "@/lib/flashcards/bands";
import { LevelBadge } from "@/components/LevelBadge";
```
Replace lines 53–58 with:
```tsx
  const [band, setBand] = useBand();
  // Rounds draw only from the chosen band ("Practise my mistakes" ignores
  // it: a missed word is worth practising whatever its level).
  const levelCards = useMemo(
    () => cards.filter((c) => inBand(c.level, band)),
    [cards, band],
  );
```
Where `<LevelPicker` is used (around line 147), pass `value={band}` and call `setBand(next)` in its `onChange` (keep whatever else that handler already does, e.g. starting a fresh deck).

- [ ] **Step 2: The picker**

Replace `LEVEL_OPTIONS` and the `LevelPicker` signature/loop (lines 254–275) so the buttons come from `BANDS`:
```tsx
function LevelPicker({ value, onChange }: { value: Band; onChange: (band: Band) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Word level</legend>
      <span aria-hidden className="mr-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        Level
      </span>
      {BANDS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          aria-label={option === "all" ? "All levels" : `Level ${option} (${option}1 and ${option}2)`}
          onClick={() => value !== option && onChange(option)}
```
Keep the existing button `className` and closing markup unchanged, and render `{BAND_LABELS[option]}` as the button text.

- [ ] **Step 3: The card badge**

Replace line 350:
```tsx
        <span className="absolute right-5 top-5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-600">{card.level} · noun</span>
```
with:
```tsx
        <span className="absolute right-5 top-5" data-card-level aria-label={`Level ${card.level}`}>
          <LevelBadge level={card.level} />
        </span>
```

- [ ] **Step 4: Check and commit Tasks 6–7 together**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all clean. Then `npm run dev`, open `/articles` and check by eye: A · B · C · All with All pressed; the coloured badge on the card; switching bands starts a new round. (C is empty until Task 8, so a C round has no cards yet; that's expected.)

```bash
git add lib/flashcards/types.ts lib/flashcards/bands.ts lib/flashcards/bands.test.mjs lib/flashcards/level.ts components/ArticlesGame.tsx
git commit -m "Level picker: A · B · C · All, with a level badge on every card"
```

### Task 8: Apply the owner's decisions and protect the deck with a data test

**Files:**
- Create: `lib/flashcards/data.test.mjs`
- Modify (generated by `apply.mjs`): `lib/flashcards/data/seed.json`, `lib/flashcards/data/rules.json`

**Interfaces:**
- Consumes: the owner-reviewed `scripts/c-levels/review.csv`; `apply.mjs` (Task 5).

- [ ] **Step 1: Write the data test (fails: no C cards yet)**

```js
// Run: npm test. Guards the built-in deck: ids, levels, rules, and the original 976 cards.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const load = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const seed = load("seed.json");
const rules = load("rules.json");
const rulesById = new Map(rules.map((r) => [r.id, r]));
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
// sha256 of JSON.stringify(seed.slice(0, 976)) on 2026-10-12, before C1/C2 words were added.
const ORIGINAL_FINGERPRINT = "8825ec0229139c1dc4f4c7f95c9180c222a152010e1dd13e75f34b9a7d305fa1";

test("the original 976 cards are unchanged", () => {
  const hash = createHash("sha256").update(JSON.stringify(seed.slice(0, 976))).digest("hex");
  assert.equal(hash, ORIGINAL_FINGERPRINT);
});

test("every card has a unique id, a valid article and level, and an existing rule", () => {
  assert.equal(new Set(seed.map((c) => c.id)).size, seed.length);
  for (const c of seed) {
    assert.ok(["der", "die", "das"].includes(c.article), c.id);
    assert.ok(LEVELS.includes(c.level), c.id);
    assert.ok(rulesById.has(c.ruleId), `${c.id} → ${c.ruleId}`);
  }
});

test("new ids start at seed-996 and continue without gaps", () => {
  const added = seed.slice(976).map((c) => Number(c.id.slice(5)));
  added.forEach((n, i) => assert.equal(n, 996 + i));
});

test("no noun appears twice", () => {
  const nouns = seed.map((c) => c.noun.toLowerCase());
  assert.equal(new Set(nouns).size, nouns.length);
});

test("ending-rule cards have that ending, or explain why not", () => {
  for (const c of seed.slice(976)) {
    const rule = rulesById.get(c.ruleId);
    if (rule.matchType !== "suffix") continue;
    const n = c.noun.toLowerCase();
    const fits = rule.suffixes.some((s) => (s.startsWith("-") ? n.endsWith(s.slice(1).toLowerCase()) : n.startsWith(s.slice(0, -1).toLowerCase())));
    assert.ok(fits || c.exception, `${c.noun} vs ${rule.suffixes}`);
  }
});

test("each band has at least a full round (30 cards)", () => {
  for (const band of ["A", "B", "C"]) {
    assert.ok(seed.filter((c) => c.level.startsWith(band)).length >= 30, band);
  }
});

test("every rule is complete and has at least 3 cards", () => {
  for (const r of rules) {
    assert.ok(r.title && r.description, r.id);
    if (r.matchType === "suffix") assert.ok(r.suffixes?.length, r.id);
    assert.ok(seed.filter((c) => c.ruleId === r.id).length >= 3, r.id);
  }
});
```
Run: `npm test` → FAIL only on "each band has at least a full round" (C has 0). Every other test passes against today's deck.

- [ ] **Step 2: Apply the owner's decisions**

Run: `node scripts/c-levels/apply.mjs` → `added N cards; ...` with N between about 250 and 280. Run it again → `added 0 cards`.

- [ ] **Step 3: Run everything**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build` → all pass. Print the counts for the PR: `node -e 'const s=require("./lib/flashcards/data/seed.json");const c={};s.forEach(x=>c[x.level]=(c[x.level]||0)+1);console.log(s.length,c)'`.

- [ ] **Step 4: Commit**

```bash
git add lib/flashcards/data.test.mjs lib/flashcards/data/seed.json lib/flashcards/data/rules.json
git commit -m "Add the approved C1/C2 words and new rules to the deck, with a data test"
```

### Task 9: Browser check and docs

**Files:**
- Create: `e2e/articles.sh`
- Modify: `e2e/README.md`, `README.md`, `CLAUDE.md` (lines 17, 26, 28 and the A1–C2 line), `docs/testing.md`

**Interfaces:**
- Consumes: `e2e/lib.sh` helpers `pw`, `js`, `text`, `check`, `result` and `BASE`.

- [ ] **Step 1: Write `e2e/articles.sh`**

```bash
#!/bin/bash
# Browser checks for the der · die · das level picker (guest, no accounts, no AI).
# Run: bash e2e/articles.sh   (BASE defaults to http://localhost:3000)
BASE=${BASE:-http://localhost:3000}
FAILED=0
pw() { playwright-cli "$@" 2>&1; }
js() { pw eval "$1" | sed -n 2p; }
check() { if eval "$2"; then echo "  ✅ $1"; else echo "  ❌ $1"; FAILED=1; fi; }
pressed() { js "() => [...document.querySelectorAll('fieldset button[aria-pressed=true]')].map(b=>b.textContent.trim()).join(',')"; }
badge() { js "() => document.querySelector('[data-card-level]')?.textContent.trim() || ''"; } # not the picker's "Level A" buttons

pw close >/dev/null; pw open "$BASE/articles" >/dev/null; pw resize 1280 800 >/dev/null; sleep 3
js "() => { localStorage.clear(); return 1 }" >/dev/null; pw reload >/dev/null; sleep 3
echo "== Picker"
check "shows A · B · C · All" '[ "$(js "() => [...document.querySelectorAll(\"fieldset button\")].map(b=>b.textContent.trim()).join(\",\")")" = "\"A,B,C,All\"" ]'
check "All is selected by default" '[ "$(pressed)" = "\"All\"" ]'
check "the card shows a level badge" '[[ "$(badge)" =~ ^\"[ABC][12]\"$ ]]'

echo "== Band C gives only C1/C2 cards"
js "() => { [...document.querySelectorAll('fieldset button')].find(b=>b.textContent.trim()==='C').click(); return 1 }" >/dev/null; sleep 2
for i in 1 2 3 4 5; do
  check "card $i is C1 or C2" '[[ "$(badge)" =~ ^\"C[12]\"$ ]]'
  js "() => { document.querySelector('main button[autofocus], main .grid button')?.click(); return 1 }" >/dev/null; sleep 1
  pw press Enter >/dev/null; sleep 1
done

echo "== Old saved choice is converted"
js "() => { localStorage.clear(); localStorage.setItem('de-app:max-level','B1'); return 1 }" >/dev/null; pw reload >/dev/null; sleep 3
check "old B1 → B" '[ "$(pressed)" = "\"B\"" ]'

echo "== Rules page lists the new rules"
pw goto "$BASE/rules" >/dev/null; sleep 3
for s in -ist -age -ade -ette; do
  check "/rules mentions $s" '[ "$(js "() => document.body.innerText.includes(\"$s\")")" = "true" ]'
done

echo "== Phone width"
pw goto "$BASE/articles" >/dev/null; pw resize 390 844 >/dev/null; sleep 3
check "no horizontal scroll at 390px" '[ "$(js "() => document.documentElement.scrollWidth <= window.innerWidth")" = "true" ]'

pw close >/dev/null
echo; [ "$FAILED" = 0 ] && echo "RESULT: PASS" || echo "RESULT: FAIL"; exit "$FAILED"
```
Only list a new rule's ending in the `/rules` loop if `apply.mjs` shipped that rule (it ships only with 3+ words); adjust the list to the rules in `rules.json`.

- [ ] **Step 2: Run it**

Run: `npm run dev` in one terminal, then `bash e2e/articles.sh` → `RESULT: PASS`. If the card-advance selector in the loop doesn't advance (check by printing `$(badge)` each time), fix the selector to match the answer buttons in `ArticlesGame.tsx`; the keyboard path (Enter on the focused "continue" button) is part of what this checks.

- [ ] **Step 3: Docs**

- `CLAUDE.md`: line 17 "~1,000 A1–B2 nouns" → "about 1,230 A1–C2 nouns" (use the real count); lines 26 and 28: add one sentence each that C1/C2 words were added in 2026-10 through the committed pipeline in `scripts/c-levels/` (see its README), with levels judged and checked against a frequency list, articles checked against Wiktionary. Keep the A1–C2 line in General Requirements as is (now true).
- `README.md`: der · die · das description counts and A1–C2; add `bash e2e/articles.sh` to the scripts table.
- `e2e/README.md`: a short `articles.sh` section (guest, no accounts, no AI, about 1 minute).
- `docs/testing.md`: rows for the data test and `e2e/articles.sh` with today's results.

- [ ] **Step 4: Commit**

```bash
git add e2e/articles.sh e2e/README.md README.md CLAUDE.md docs/testing.md
git commit -m "Add the level-picker browser check and document the C1/C2 words"
```

### Task 10: Review, scan, PR 2

- [ ] **Step 1:** Run the `ai-code-reviewer` agent on `main...feature/c-level-words` (PR 2 changes), save the report as `docs/reviews/pr-<n>-c-level-words.md`, fix confirmed findings (tests first), re-run `npm test && npm run build && bash e2e/articles.sh`.
- [ ] **Step 2:** Run `/security-scan-changed`; fix confirmed findings.
- [ ] **Step 3:** Suggest usability tests to the owner (CLAUDE.md): a C round on a phone, the badge colours in light and dark mode, a learner switching bands mid-session, "Practise my mistakes" with C words.
- [ ] **Step 4:** With the owner's OK: push and open PR 2. After it is merged and deployed, run `BASE=https://de-app-six.vercel.app bash e2e/articles.sh` and record the result in `docs/testing.md`.
