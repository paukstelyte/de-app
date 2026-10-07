"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CHAT_ERRORS,
  cleanHistory,
  errorForStatus,
  extractReply,
  findPersona,
  toModelMessages,
  type ChatResult,
} from "@/lib/chat";
import { systemPromptFor } from "@/lib/chat-prompts";

// To switch models, set OPENROUTER_MODEL in .env.local (and in Vercel).
const MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Sends the conversation to the chosen tutor persona and returns its reply.
 * The OpenRouter key and the persona prompts never leave the server; the
 * browser's history is re-checked here because it can't be trusted. */
export async function sendChatMessage(personaId: string, messages: unknown): Promise<ChatResult> {
  const persona = findPersona(personaId);
  const history = cleanHistory(messages);
  if (!persona || !history) return { error: CHAT_ERRORS.generic };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: CHAT_ERRORS.loggedOut };

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("sendChatMessage: OPENROUTER_API_KEY is not set");
    return { error: CHAT_ERRORS.generic };
  }

  // Counts this message against the user's limit (see docs/supabase-schema.md).
  const { error: quotaError } = await supabase.rpc("use_chat_quota");
  if (quotaError) {
    if (quotaError.code === "P0001") return { error: CHAT_ERRORS.limit };
    console.error("use_chat_quota failed:", quotaError.message);
    return { error: CHAT_ERRORS.generic };
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "DE-app",
      },
      body: JSON.stringify({ model: MODEL, messages: toModelMessages(systemPromptFor(persona.id)!, persona.id, history), max_tokens: 800 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error("OpenRouter error:", res.status, (await res.text()).slice(0, 500));
      return { error: errorForStatus(res.status) };
    }
    const reply = extractReply(await res.json());
    if (!reply) console.error("OpenRouter returned no reply text");
    return reply ? { reply } : { error: CHAT_ERRORS.generic };
  } catch (err) {
    console.error("OpenRouter request failed:", err instanceof Error ? err.message : err);
    return { error: CHAT_ERRORS.generic };
  }
}
