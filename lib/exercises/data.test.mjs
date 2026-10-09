// Validates every exercise set in lib/exercises/data/*.json. Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dir = new URL("./data/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const topics = JSON.parse(readFileSync(new URL("../grammar/topics.json", import.meta.url), "utf8"));
const sets = files.map((f) => ({ file: f, set: JSON.parse(readFileSync(new URL(f, dir), "utf8")) }));
const gaps = (s) => s.split("___").length - 1;
const sorted = (xs) => [...xs].sort().join("\u0000");

for (const { file, set } of sets) {
  test(`${file} is a valid exercise set`, () => {
    assert.equal(set.slug + ".json", file);
    assert.ok(topics.some((t) => t.slug === set.slug), "slug is in the catalogue");
    assert.notEqual(set.slug, "noun-gender");
    assert.ok(typeof set.instructions === "string" && set.instructions.trim(), "instructions");
    assert.equal(set.items.length, 30);
    const ids = set.items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, "unique ids");
    for (const item of set.items) {
      const at = `${file} ${item.id}`;
      assert.match(item.id, /^[a-z0-9-]{1,64}$/, at);
      assert.ok(item.explanation.length >= 10 && item.explanation.length <= 300, `${at} explanation length`);
      if (item.type === "choice") {
        assert.ok(item.options.length >= 2 && item.options.length <= 4, `${at} option count`);
        assert.equal(new Set(item.options).size, item.options.length, `${at} unique options`);
        assert.ok(item.options.includes(item.answer), `${at} answer in options`);
        assert.equal(gaps(item.prompt), 1, `${at} one gap`);
      } else if (item.type === "type") {
        assert.equal(gaps(item.prompt), 1, `${at} one gap`);
        assert.ok(item.answers.length > 0, `${at} answers`);
        for (const a of item.answers) assert.ok(a.length <= 64 && !a.includes("___"), `${at} answer "${a}"`);
      } else if (item.type === "order") {
        assert.ok(item.words.length >= 3, `${at} words`);
        for (const a of item.answers) assert.equal(sorted(a.split(" ")), sorted(item.words), `${at} "${a}" uses the words`);
        assert.ok(item.answers.includes(item.words.join(" ")), `${at} words in order is an answer`);
      } else assert.fail(`${at} unknown type`);
    }
  });
}

test("topics.json and sets.ts agree with the data files", () => {
  const slugs = sets.map((s) => s.set.slug);
  const sync = readFileSync(new URL("./sets.ts", import.meta.url), "utf8");
  for (const slug of slugs) {
    const t = topics.find((x) => x.slug === slug);
    assert.equal(t?.exercises?.[0]?.href, `/topics/${slug}/practice`, slug);
    assert.ok(sync.includes(`"${slug}"`), `sets.ts mentions ${slug}`);
  }
  for (const t of topics) {
    if (t.exercises?.some((e) => /^\/topics\/[^/]+\/practice$/.test(e.href))) {
      assert.ok(slugs.includes(t.slug), `${t.slug} has a data file`);
    }
  }
});
