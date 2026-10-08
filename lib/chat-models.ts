// Server only: reads OPENROUTER_API_KEY. Import only from server code
// (app/chat/page.tsx, app/chat/actions.ts); the browser gets just the
// resulting ids, names and price tiers.
import { chatModelsFrom, type ChatModel } from "@/lib/chat";

/** Used when no model is chosen, or the choice isn't allowed. Override with OPENROUTER_MODEL. */
export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it";

/** The chat models this OpenRouter key may use, cheapest first. Cached for an
 * hour, so changes to the account's allowed models show up without a deploy.
 * Returns [] if OpenRouter can't be reached; the chat then uses DEFAULT_MODEL. */
export async function getChatModels(): Promise<ChatModel[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models/user", {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("OpenRouter model list failed:", res.status);
      return [];
    }
    return chatModelsFrom(await res.json());
  } catch (err) {
    console.error("OpenRouter model list failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
