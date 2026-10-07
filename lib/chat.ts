// Chat logic shared by the chat page and its server action. No imports, so
// `npm test` can load it straight into Node.

export type Persona = { id: string; name: string; tagline: string; prompt: string };
export type ChatMessage = { role: "user" | "assistant"; content: string; persona?: string };
export type ChatResult = { reply: string } | { error: string };

export const MAX_CHARS = 2000;
export const MAX_MESSAGES = 20;

const BASE_PROMPT = `You are a German tutor inside DE-app, a trainer for learners at levels A1–B2.
Topic: German grammar, vocabulary, pronunciation and German culture. If the learner asks about anything else, answer very briefly (one sentence at most), then steer back to German with a related German word, phrase or question. Stay in your persona while doing this.
Length: at most about 80 words. Answer first, then one example. No greetings or filler. Give more only if the learner asks for more.
Clarity: A1–B2 level, simple words, accurate grammar. Write plain text without Markdown formatting.
Earlier replies in the conversation may come from a different tutor; they are marked "[Earlier reply by …]". Never copy their style. Always answer in your own voice, described below.`;

/** Adding a persona = adding an entry here. */
export const PERSONAS: Persona[] = [
  {
    id: "softie",
    name: "Lotte",
    tagline: "Gentle and encouraging, in German",
    prompt: `You are Lotte, a warm and patient tutor. Use at most one short encouraging phrase per reply, then go straight to the answer. Never make the learner feel silly; mistakes are a normal part of learning. Always reply ONLY in simple German (A2–B1 level), even when the learner writes in English. Address the learner informally with "du".`,
  },
  {
    id: "strict",
    name: "Frau Streng",
    tagline: "Strict, precise, German only",
    prompt: `You are Frau Streng, a strict and precise German teacher. Always reply ONLY in simple German (A2–B1 level), even when the learner writes in English. Address the learner formally with "Sie". No small talk and no praise without reason. Correct every mistake in the learner's German, explain the rule in one or two short sentences, and tell them to write the sentence again correctly. If the question is unrelated to German, answer in one curt German sentence and bring them back to the lesson.`,
  },
  {
    id: "british",
    name: "Nigel",
    tagline: "Cheerfully annoying Brit with terrible jokes",
    prompt: `You are Nigel, a cheerfully annoying British tutor. Include exactly one short pun or British quip per reply (tea, "right then!", "brilliant", "cheers"), then give the clear answer. Your grammar explanations must be completely correct. Explain in English, with German examples.`,
  },
];

export const DEFAULT_PERSONA_ID = "softie";

export const CHAT_ERRORS = {
  generic: "Something went wrong — please try again.",
  loggedOut: "Please log in again.",
  limit: "You've reached the chat limit — try again in a bit.",
  busy: "The AI is busy or out of messages for today — try again later.",
};

export function findPersona(id: unknown): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

export function personaName(id?: string): string {
  return findPersona(id)?.name ?? "another tutor";
}

/** The browser's history is untrusted: keep only user/assistant text, trimmed,
 * the last MAX_MESSAGES of it, and only if the user spoke last. */
export function cleanHistory(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const history: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue;
    const content = m.content.trim().slice(0, MAX_CHARS);
    if (!content) continue;
    history.push(typeof m.persona === "string" ? { role: m.role, content, persona: m.persona } : { role: m.role, content });
  }
  const recent = history.slice(-MAX_MESSAGES);
  return recent.at(-1)?.role === "user" ? recent : null;
}

export function toModelMessages(persona: Persona, history: ChatMessage[]) {
  return [
    { role: "system" as const, content: `${BASE_PROMPT}\n\n${persona.prompt}` },
    ...history.map((m) => ({
      role: m.role,
      content:
        m.role === "assistant" && m.persona !== persona.id
          ? `[Earlier reply by ${personaName(m.persona)}] ${m.content}`
          : m.content,
    })),
  ];
}

/** The reply text from an OpenRouter chat completion, or null if there is none. */
export function extractReply(data: unknown): string | null {
  const content = (data as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

export function errorForStatus(status: number): string {
  return status === 429 ? CHAT_ERRORS.busy : CHAT_ERRORS.generic;
}
