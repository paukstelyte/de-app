-- Vector store for the chat (RAG): users' notes, split into chunks, each chunk
-- with an embedding from openai/text-embedding-3-small (1536 numbers).
-- Follows Supabase's "Vector columns" and "Semantic search" guides.
-- CLAUDE.md: the embedding column is vector(1536); never change the dimension or
-- the embedding model without dropping and re-embedding every document.

-- 1. pgvector, in the extensions schema (as the Supabase guides do).
create extension if not exists vector with schema extensions;

-- 2. The source notes: each user's own study notes.
create table public.notes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now(),
  -- Lets documents point at (note, owner) together, so a chunk can never be
  -- attached to someone else's note.
  unique (id, user_id)
);

create index notes_user_id_idx on public.notes (user_id);

-- 3. The chunks: one row per piece of a note, with its embedding.
create table public.documents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  note_id bigint not null,
  content text not null check (char_length(content) between 1 and 8000),
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  -- Deleting a note deletes its chunks; the chunk's owner must be the note's owner.
  foreign key (note_id, user_id) references public.notes (id, user_id) on delete cascade
);

create index documents_user_id_idx on public.documents (user_id);
create index documents_note_id_idx on public.documents (note_id);
-- HNSW with inner product: OpenAI embeddings are normalized, and the semantic
-- search guide recommends <#> (inner product) as fastest for them.
create index documents_embedding_idx on public.documents
  using hnsw (embedding extensions.vector_ip_ops);

-- 4. Row Level Security: each user sees and changes only their own rows.
alter table public.notes enable row level security;
alter table public.documents enable row level security;

create policy "Users read their own notes" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own notes" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users edit their own notes" on public.notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own notes" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read their own chunks" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own chunks" on public.documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete their own chunks" on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);
-- No update policy on chunks: a changed note is re-chunked (delete + insert).

-- New tables start with no privileges (20261007120000), so grant exactly what's used.
revoke all on public.notes, public.documents from anon, authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, delete on public.documents to authenticated;

-- 5. Semantic search: the caller's chunks most similar to the query embedding.
-- Security invoker (the default) on purpose: RLS still applies inside, so
-- passing someone else's user id returns nothing rather than their chunks.
create function public.match_documents (
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (id bigint, note_id bigint, content text, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.id,
    d.note_id,
    d.content,
    -- For normalized vectors, -(inner product distance) = cosine similarity (-1..1).
    -(d.embedding operator(extensions.<#>) query_embedding) as similarity
  from public.documents d
  where d.user_id = p_user_id
    and d.embedding operator(extensions.<#>) query_embedding < -match_threshold
  order by d.embedding operator(extensions.<#>) query_embedding asc
  limit least(match_count, 200);
$$;

revoke execute on function public.match_documents(extensions.vector, float, int, uuid) from public, anon;
grant execute on function public.match_documents(extensions.vector, float, int, uuid) to authenticated;
