-- Model display and usage indicator: remember which model read each document
-- and what it cost (from OpenRouter's response metadata). Older rows stay null.
alter table public.learning_documents
  add column model text check (char_length(model) between 1 and 100),
  add column prompt_tokens integer check (prompt_tokens >= 0),
  add column completion_tokens integer check (completion_tokens >= 0),
  add column cost_usd numeric(12, 8) check (cost_usd >= 0 and cost_usd < 1);

-- The app saves these alongside the document; users still can't change a saved row.
grant insert (model, prompt_tokens, completion_tokens, cost_usd) on public.learning_documents to authenticated;
