-- Security scan follow-ups for the RAG notes (2026-10-09).

-- 1a. Save quota: every note save pays for embeddings, so it's rate-limited
--     like the chat. One row per save; users can't read or touch the table,
--     only spend through use_note_quota().
create table public.note_save_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index note_save_usage_user_created_idx on public.note_save_usage (user_id, created_at);
alter table public.note_save_usage enable row level security;
revoke all on public.note_save_usage from anon, authenticated;

-- At most 10 saves per minute and 50 per 24 hours per user.
create function public.use_note_quota() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('note_save_usage:' || uid::text));
  if (select count(*) from public.note_save_usage
        where user_id = uid and created_at > now() - interval '1 minute') >= 10
     or (select count(*) from public.note_save_usage
        where user_id = uid and created_at > now() - interval '24 hours') >= 50 then
    raise exception 'Note save limit reached' using errcode = 'P0001';
  end if;
  insert into public.note_save_usage (user_id) values (uid);
end;
$$;
revoke execute on function public.use_note_quota() from public, anon;
grant execute on function public.use_note_quota() to authenticated;

-- 1b. Storage caps, enforced by the database so they also hold for direct
--     inserts through the API: 100 notes and 1,500 chunks per user. Row-level
--     BEFORE triggers see rows added earlier in the same statement, so one
--     big insert is capped too. Security invoker: RLS shows the user their own
--     rows, which is exactly what's counted.
create function public.enforce_notes_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.notes where user_id = new.user_id) >= 100 then
    raise exception 'Note limit reached (100 notes)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger notes_limit before insert on public.notes
  for each row execute function public.enforce_notes_limit();

create function public.enforce_documents_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.documents where user_id = new.user_id) >= 1500 then
    raise exception 'Note storage limit reached (1,500 chunks)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger documents_limit before insert on public.documents
  for each row execute function public.enforce_documents_limit();

revoke execute on function public.enforce_notes_limit() from public, anon, authenticated;
revoke execute on function public.enforce_documents_limit() from public, anon, authenticated;

-- 1c. A single save may hold at most 60 chunks (a 20,000-character note
--     splits into ~56). Same function as before plus that check.
create or replace function public.save_note_with_chunks(
  p_note_id bigint,
  p_title text,
  p_content text,
  p_chunks text[],
  p_embeddings text[]
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_note_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;
  if coalesce(array_length(p_chunks, 1), 0) = 0
     or array_length(p_chunks, 1) is distinct from array_length(p_embeddings, 1) then
    raise exception 'Each chunk needs exactly one embedding' using errcode = '22023';
  end if;
  if array_length(p_chunks, 1) > 60 then
    raise exception 'Too many chunks in one note (max 60)' using errcode = '22023';
  end if;

  if p_note_id is null then
    insert into public.notes (title, content) values (p_title, p_content)
    returning id into v_note_id;
  else
    update public.notes set title = p_title, content = p_content
    where id = p_note_id
    returning id into v_note_id;
    if v_note_id is null then
      raise exception 'Note not found' using errcode = 'P0002';
    end if;
    delete from public.documents where note_id = v_note_id;
  end if;

  insert into public.documents (note_id, content, embedding)
  select v_note_id, chunk, embedding::extensions.vector
  from unnest(p_chunks, p_embeddings) as t(chunk, embedding);

  return v_note_id;
end;
$$;

-- 4 + 7. match_documents: also filter on the caller's login, so it stays safe
--     even if it's ever switched to security definer (p_user_id alone would
--     then leak other users' chunks). And turn on pgvector's iterative index
--     scan for this search only, so HNSW keeps looking until it has enough of
--     the caller's own chunks instead of giving up after the nearest 40 across
--     all users. (Supabase doesn't allow these settings in the function's SET
--     clause, so it's plpgsql with set_config(..., true): local to this call.)
create or replace function public.match_documents (
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (id bigint, note_id bigint, content text, similarity float)
language plpgsql
volatile
security invoker -- never change to definer
set search_path = ''
as $$
begin
  perform set_config('hnsw.iterative_scan', 'strict_order', true);
  perform set_config('hnsw.ef_search', '100', true);
  return query
    select
      d.id,
      d.note_id,
      d.content,
      (-(d.embedding operator(extensions.<#>) query_embedding))::float as similarity
    from public.documents d
    where d.user_id = p_user_id
      and d.user_id = (select auth.uid())
      and d.embedding operator(extensions.<#>) query_embedding < -match_threshold
    order by d.embedding operator(extensions.<#>) query_embedding asc
    limit least(match_count, 200);
end;
$$;
