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
  model: "This model isn't available right now — try another one.",
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

/** Saved chat_messages rows (oldest first) back into chat messages. */
export function rowsToMessages(
  rows: { role: string; content: string; persona: string | null }[] | null,
): ChatMessage[] {
  return (rows ?? []).flatMap((r): ChatMessage[] =>
    (r.role === "user" || r.role === "assistant") && r.content
      ? [r.persona ? { role: r.role, content: r.content, persona: r.persona } : { role: r.role, content: r.content }]
      : [],
  );
}

/** `effort`: the reasoning effort to request, only for models that think by
 * default (sending it to others switches thinking on and slows them down). */
export type ChatModel = { id: string; name: string; tier: "$" | "$$" | "$$$"; effort?: string };

type ApiModel = {
  id?: unknown;
  name?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
  architecture?: { input_modalities?: unknown; output_modalities?: unknown };
  reasoning?: { mandatory?: unknown; default_enabled?: unknown; supported_efforts?: unknown } | null;
};

/** The lightest supported effort for a model that thinks by default, else undefined. */
function lightestEffort(reasoning: ApiModel["reasoning"]): string | undefined {
  if (!reasoning || (reasoning.mandatory !== true && reasoning.default_enabled !== true)) return undefined;
  const supported = Array.isArray(reasoning.supported_efforts) ? reasoning.supported_efforts : [];
  return ["minimal", "low", "none"].find((e) => supported.includes(e));
}

/** The chat-capable models from OpenRouter's /models/user response, cheapest
 * first. Keeps text-in, text-only-out models; drops batch-only and coding
 * variants and the "~…-latest" aliases (duplicates of listed models). */
export function chatModelsFrom(data: unknown): ChatModel[] {
  const list = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) return [];
  return (list as ApiModel[])
    .flatMap((m) => {
      const input = m.architecture?.input_modalities;
      const output = m.architecture?.output_modalities;
      const prompt = Number(m.pricing?.prompt);
      const completion = Number(m.pricing?.completion);
      if (
        typeof m.id !== "string" || m.id.startsWith("~") || m.id.endsWith(":batch") || m.id.includes("codex") ||
        !Array.isArray(input) || !input.includes("text") ||
        !Array.isArray(output) || output.length !== 1 || output[0] !== "text" ||
        !Number.isFinite(prompt) || !Number.isFinite(completion)
      ) return [];
      // Rough cost of a typical reply: ~1,500 tokens in, ~300 out.
      const perReply = prompt * 1500 + completion * 300;
      return [{ id: m.id, name: typeof m.name === "string" ? m.name : m.id, perReply, effort: lightestEffort(m.reasoning) }];
    })
    .sort((a, b) => a.perReply - b.perReply)
    .map(({ id, name, perReply, effort }): ChatModel => ({
      id,
      name,
      tier: perReply < 0.001 ? "$" : perReply < 0.003 ? "$$" : "$$$",
      ...(effort && { effort }),
    }));
}

/** The browser's model choice is untrusted: use it only if it's in the allowed list. */
export function pickModel(requested: unknown, allowed: ChatModel[], fallback: string): string {
  return allowed.some((m) => m.id === requested) ? (requested as string) : fallback;
}

/** The reply text from an OpenRouter chat completion, or null if there is none. */
export function extractReply(data: unknown): string | null {
  const content = (data as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

export function errorForStatus(status: number): string {
  if (status === 429) return CHAT_ERRORS.busy;
  // 404: model gone or blocked for this key; 400: the model rejected the request.
  if (status === 404 || status === 400) return CHAT_ERRORS.model;
  return CHAT_ERRORS.generic;
}
