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
  type ChatMessage,
  type ChatResult,
} from "@/lib/chat";
import { DEFAULT_MODEL, getChatModels } from "@/lib/chat-models";
import { systemPromptFor } from "@/lib/chat-prompts";
import { embed } from "@/lib/embeddings";
import { MATCH_COUNT, MATCH_THRESHOLD, notesContext, retrievalQuery, type Match } from "@/lib/rag";

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

  // RAG: search this user's own notes for what's relevant and hand it to the
  // tutor for this reply only (it isn't added to the saved conversation).
  const notes = await notesContextFor(supabase, data.claims.sub, history);
  const systemPrompt = notes ? `${systemPromptFor(persona.id)!}\n\n${notes}` : systemPromptFor(persona.id)!;

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
        messages: toModelMessages(systemPrompt, persona.id, history),
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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Searches only the logged-in user's notes for chunks relevant to the
 * conversation and turns them into extra tutor instructions. Everything here
 * runs on the server: the question's embedding and the chunks never reach the
 * browser. Returns null if the search can't run, so the chat still answers. */
async function notesContextFor(supabase: Supabase, userId: string, history: ChatMessage[]): Promise<string | null> {
  const [queryEmbedding] = (await embed([retrievalQuery(history)])) ?? [];
  if (!queryEmbedding) return null;

  // userId comes from the login on the server, never from the browser; RLS
  // also limits match_documents to the caller's own rows.
  const { data: matches, error } = await supabase.rpc("match_documents", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
    p_user_id: userId,
  });
  if (error) {
    console.error("match_documents failed:", error.message);
    return null;
  }

  const rows = (matches ?? []) as Match[];
  const noteIds = [...new Set(rows.map((r) => r.note_id))];
  let titles: Record<number, string> = {};
  if (noteIds.length > 0) {
    const { data: found } = await supabase.from("notes").select("id, title").in("id", noteIds);
    titles = Object.fromEntries((found ?? []).map((n) => [n.id, n.title]));
  }
  return notesContext(rows, titles);
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
