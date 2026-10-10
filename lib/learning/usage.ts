// Which model read a document and what it cost, taken from OpenRouter's response
// metadata, plus readable labels for the page. No imports, so Node tests load it.

export type Usage = { model: string; promptTokens: number | null; completionTokens: number | null; costUsd: number | null };

const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);

export function readUsage(json: unknown, requestedModel: string): Usage {
  const r = (json ?? {}) as { model?: unknown; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown } };
  const cost = r.usage?.cost;
  return {
    model: typeof r.model === "string" && r.model.length > 0 && r.model.length <= 100 ? r.model : requestedModel,
    promptTokens: count(r.usage?.prompt_tokens),
    completionTokens: count(r.usage?.completion_tokens),
    costUsd: typeof cost === "number" && Number.isFinite(cost) && cost >= 0 && cost < 1 ? cost : null,
  };
}

/** "google/gemini-2.5-flash-lite" → "Gemini 2.5 Flash Lite". */
export function formatModel(slug: string): string {
  const name = slug.split("/").pop() ?? slug;
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Tiny amounts get one significant digit, larger ones two: $0.0004, $0.012. */
export function formatCost(usd: number | null): string | null {
  if (usd === null) return null;
  if (usd === 0) return "$0";
  return `$${Number(usd.toPrecision(usd < 0.001 ? 1 : 2))}`;
}
