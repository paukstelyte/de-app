-- Fixes from the full security scan of 2026-10-12 (docs/reviews/2026-10-12-security-scan.md).

-- #4 Documents come only from a real, counted AI read: the server saves them with the
-- admin key (app/learning/actions.ts), so users can no longer insert them directly
-- (which skipped the upload quota and let them forge topics, model and cost).
drop policy "Users add their own documents" on public.learning_documents;
revoke insert on public.learning_documents from authenticated;

-- #5 updated_at on a focus row is set by the database, not by the user: the default
-- on insert, this trigger on update.
create function public.learning_focus_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;
revoke execute on function public.learning_focus_touch() from public, anon, authenticated;
create trigger learning_focus_touch before update on public.learning_focus
  for each row execute function public.learning_focus_touch();
revoke insert (updated_at), update (updated_at) on public.learning_focus from authenticated;

-- #6 Leftover sequence grants from before default privileges were closed (nothing used them).
revoke all on sequence public.attempts_id_seq from anon, authenticated;

-- #8 The upload-folder count only serves the storage policy, so it moves out of the
-- API-exposed public schema. authenticated keeps usage and execute, because the
-- policy runs as the uploading user.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
alter function public.learning_upload_count() set schema private;

drop policy "Users upload into their own folder" on storage.objects;
create policy "Users upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learning-uploads'
    and name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9-]{1,64}/[0-9]\.(pdf|docx|jpg|jpeg|png|webp|heic|heif)$')
    and (select private.learning_upload_count()) < 5
  );
