// A stand-in for OpenRouter's chat completions API, used by the browser tests so they
// are repeatable, free and never send a document anywhere. The app is pointed at it with
// OPENROUTER_BASE_URL. It also checks the request shape the app must keep: the
// instructions in a system message, the document in its own user message, and PDFs read
// with the native file parser (never the paid OCR fallback).
//
// What it answers depends on a marker inside the uploaded file:
//   MOCK:BLANK      no readable text       MOCK:INVALID   topics outside the catalogue
//   MOCK:NOGRAMMAR  text but no grammar    (none)         the "Lektion 7" dative answer
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_OPENROUTER_PORT ?? 3199);

const LEKTION_7 = {
  title: "Lektion 7: Präpositionen mit Dativ",
  extractedText: "Lektion 7: Präpositionen mit Dativ\naus, bei, mit, nach, seit, von, zu\nIch fahre mit dem Bus zur Arbeit.",
  noGrammar: false,
  topics: [
    { slug: "prepositions-dative", reason: "\"mit dem Bus\" uses a dative preposition", fromMistake: false },
    { slug: "dative-case", reason: "\"dem Bus\" is dative", fromMistake: false },
  ],
};
const ANSWERS = {
  "MOCK:BLANK": { title: "Blank page", extractedText: "", noGrammar: true, topics: [] },
  "MOCK:INVALID": { ...LEKTION_7, topics: [{ slug: "not-a-real-topic", reason: "made up", fromMistake: false }] },
  "MOCK:NOGRAMMAR": { title: "Shopping list", extractedText: "milk, bread, apples", noGrammar: true, topics: [] },
};

/** Everything the app sent as the document, decoded, so markers inside files are found. */
function documentText(parts) {
  return parts
    .map((p) => {
      if (p.type === "text") return p.text;
      const url = p.type === "file" ? p.file.file_data : p.image_url?.url;
      return Buffer.from(String(url).split(",")[1] ?? "", "base64").toString("latin1");
    })
    .join("\n");
}

function problem(body) {
  const [system, user] = body.messages ?? [];
  if (system?.role !== "system" || typeof system.content !== "string") return "the instructions must be a system message";
  if (user?.role !== "user" || !Array.isArray(user.content)) return "the document must be in its own user message";
  if (body.response_format?.json_schema?.strict !== true) return "the answer schema must be strict";
  const hasPdf = user.content.some((p) => p.type === "file");
  if (hasPdf && body.plugins?.[0]?.pdf?.engine !== "native") return "PDFs must use the native file-parser engine";
  return null;
}

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const send = (status, json) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    if (req.url === "/health") return send(200, { ok: true });
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) return send(404, { error: "not found" });
    const body = JSON.parse(raw);
    const bad = problem(body);
    if (bad) return send(400, { error: { message: `mock-openrouter: ${bad}` } });
    const text = documentText(body.messages[1].content);
    const marker = Object.keys(ANSWERS).find((m) => text.includes(m));
    send(200, {
      model: body.model,
      choices: [{ message: { content: JSON.stringify(marker ? ANSWERS[marker] : LEKTION_7) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3000, completion_tokens: 400, cost: 0.0004 },
    });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock OpenRouter on http://127.0.0.1:${PORT}`));
