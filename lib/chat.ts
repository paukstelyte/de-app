// Chat logic shared by the chat page and its server action. No imports, so
// `npm test` can load it straight into Node.

export type Persona = { id: string; name: string; tagline: string }; // prompts: lib/chat-prompts.ts (server only)
export type ChatMessage = { role: "user" | "assistant"; content: string; persona?: string };
export type ChatResult = { reply: string } | { error: string };

export const MAX_CHARS = 2000;
export const MAX_MESSAGES = 20;

/** Adding a persona = adding an entry here. */
export const PERSONAS: Persona[] = [
  {
    id: "softie",
    name: "Lotte",
    tagline: "Gentle and encouraging, in German",
  },
  {
    id: "strict",
    name: "Frau Streng",
    tagline: "Strict, precise, German only",
  },
  {
    id: "british",
    name: "Nigel",
    tagline: "Silly Brit with dry, ironic humour",
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

export function toModelMessages(systemPrompt: string, personaId: string, history: ChatMessage[]) {
  return [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role,
      content:
        m.role === "assistant" && m.persona !== personaId
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
