"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CHAT_ERRORS,
  cleanHistory,
  errorForStatus,
  extractReply,
  findPersona,
  pickModel,
  toModelMessages,
  type ChatResult,
} from "@/lib/chat";
import { DEFAULT_MODEL, getChatModels } from "@/lib/chat-models";
import { systemPromptFor } from "@/lib/chat-prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Sends the conversation to the chosen tutor persona and model and returns its
 * reply. The OpenRouter key and the persona prompts never leave the server; the
 * browser's history and model choice are re-checked here because they can't be
 * trusted. */
export async function sendChatMessage(personaId: string, modelId: unknown, messages: unknown): Promise<ChatResult> {
  const persona = findPersona(personaId);
  const history = cleanHistory(messages);
  if (!persona || !history) return { error: CHAT_ERRORS.generic };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: CHAT_ERRORS.loggedOut };

  // Only models this key allows for chat; anything else falls back to the default.
  const models = await getChatModels();
  const model = pickModel(modelId, models, DEFAULT_MODEL);
  const effort = models.find((m) => m.id === model)?.effort;

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
      body: JSON.stringify({
        model,
        messages: toModelMessages(systemPromptFor(persona.id)!, persona.id, history),
        // Models that think by default get the lightest effort, or they can spend
        // the whole budget thinking and return empty text. Others get nothing:
        // asking switches their thinking on and makes them much slower.
        ...(effort && { reasoning: { effort } }),
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error("OpenRouter error:", res.status, (await res.text()).slice(0, 500));
      return { error: errorForStatus(res.status) };
    }
    const reply = extractReply(await res.json());
    if (!reply) {
      console.error("OpenRouter returned no reply text");
      return { error: CHAT_ERRORS.generic };
    }
    // Save the turn so the conversation survives a reload. A failed save is
    // logged but doesn't cost the user their reply.
    const { error: saveError } = await supabase.rpc("save_chat_turn", {
      user_text: history.at(-1)!.content,
      reply,
      persona: persona.id,
    });
    if (saveError) console.error("save_chat_turn failed:", saveError.message);
    return { reply };
  } catch (err) {
    console.error("OpenRouter request failed:", err instanceof Error ? err.message : err);
    return { error: CHAT_ERRORS.generic };
  }
}

/** "New chat": deletes the caller's saved conversation (RLS limits it to their rows). */
export async function clearChat(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: CHAT_ERRORS.loggedOut };

  const { error } = await supabase.from("chat_messages").delete().eq("user_id", data.claims.sub);
  if (error) {
    console.error("clearChat failed:", error.message);
    return { error: CHAT_ERRORS.generic };
  }
  return {};
}
