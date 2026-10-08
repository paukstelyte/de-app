// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MATCH_COUNT, MATCH_THRESHOLD, notesContext, retrievalQuery } from "./rag.ts";

const user = (content) => ({ role: "user", content });
const bot = (content) => ({ role: "assistant", content, persona: "softie" });

test("search settings: top 5 chunks above a 0.4 similarity", () => {
  assert.equal(MATCH_COUNT, 5);
  assert.equal(MATCH_THRESHOLD, 0.4);
});

test("retrievalQuery searches with the latest message plus the previous one from the learner", () => {
  const history = [user("When is the London meetup?"), bot("On 14 November."), user("Say that again more simply.")];
  assert.equal(retrievalQuery(history), "When is the London meetup?\nSay that again more simply.");
});

test("retrievalQuery uses just the message when it's the first one", () => {
  assert.equal(retrievalQuery([user("Which prepositions take the dative?")]), "Which prepositions take the dative?");
});

test("retrievalQuery ignores the tutor's replies", () => {
  const history = [bot("Hallo!"), user("Was ist der Dativ?")];
  assert.equal(retrievalQuery(history), "Was ist der Dativ?");
});

test("notesContext lists the matching chunks under their note titles, most relevant first", () => {
  const context = notesContext(
    [
      { note_id: 2, content: "Meetup at the Goethe-Institut, 7pm.", similarity: 0.57 },
      { note_id: 1, content: "mit, nach, aus take the dative.", similarity: 0.45 },
    ],
    { 1: "Dative prepositions", 2: "London event" },
  );
  assert.ok(context.indexOf('"London event"') < context.indexOf('"Dative prepositions"'));
  assert.ok(context.includes("Meetup at the Goethe-Institut, 7pm."));
  assert.ok(context.includes("mit, nach, aus take the dative."));
  assert.match(context, /based on your note/);
  assert.match(context, /even if they are not about German/);
});

test("notesContext tells the tutor to say so when nothing matched, then answer briefly as general knowledge", () => {
  const context = notesContext([], {});
  assert.match(context, /No relevant notes/);
  assert.match(context, /couldn't find/);
  assert.match(context, /general knowledge/);
  // Said plainly first, not hidden in a persona joke.
  assert.match(context, /Start your reply with this plain sentence: "I couldn't find this in your notes\."/);
  assert.match(context, /translate it if you reply in German/);
});

test("notesContext falls back to a placeholder title if a note title is missing", () => {
  assert.ok(notesContext([{ note_id: 9, content: "x", similarity: 0.5 }], {}).includes('"Untitled note"'));
});
