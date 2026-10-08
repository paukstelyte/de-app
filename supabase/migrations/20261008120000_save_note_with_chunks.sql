-- Saves a note and its embedded chunks in one transaction (all or nothing).
-- New note (p_note_id null): inserts the note and its chunks.
-- Edit: updates the note, deletes ALL its old chunks and inserts the new ones,
-- so no stale embeddings from the previous version survive.
-- The server embeds the chunks first (app/notes/actions.ts); if that fails,
-- this is never called and nothing changes.
-- Security invoker: runs with the caller's rights, so RLS applies: a user can
-- only create and edit their own notes, and user_id comes from auth.uid().
create function public.save_note_with_chunks(
  p_note_id bigint,
  p_title text,
  p_content text,
  p_chunks text[],
  p_embeddings text[] -- one '[0.01, …]' per chunk, same order
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

  if p_note_id is null then
    insert into public.notes (title, content) values (p_title, p_content)
    returning id into v_note_id;
  else
    update public.notes set title = p_title, content = p_content
    where id = p_note_id
    returning id into v_note_id;
    if v_note_id is null then -- not found, or someone else's (RLS hides it)
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

revoke execute on function public.save_note_with_chunks(bigint, text, text, text[], text[]) from public, anon;
grant execute on function public.save_note_with_chunks(bigint, text, text, text[], text[]) to authenticated;
