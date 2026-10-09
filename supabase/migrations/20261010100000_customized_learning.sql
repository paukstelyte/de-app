-- Customized Learning: saved documents with AI topic suggestions, the
-- learner's focus overrides, an upload quota, and a private bucket for files
-- in transit (the server deletes them right after reading).

create table public.learning_documents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  extracted_text text not null default '' check (char_length(extracted_text) <= 8000),
  no_grammar boolean not null default false,
  suggestions jsonb not null default '[]' check (jsonb_typeof(suggestions) = 'array' and jsonb_array_length(suggestions) <= 6),
  created_at timestamptz not null default now()
);
create index learning_documents_user_created_idx on public.learning_documents (user_id, created_at desc);
alter table public.learning_documents enable row level security;
create policy "Users read their own documents" on public.learning_documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own documents" on public.learning_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete their own documents" on public.learning_documents
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learning_documents from anon, authenticated;
grant select, delete on public.learning_documents to authenticated;
grant insert (title, extracted_text, no_grammar, suggestions) on public.learning_documents to authenticated;

-- At most 200 saved documents per user (also for direct API inserts).
create function public.enforce_learning_documents_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.learning_documents where user_id = new.user_id) >= 200 then
    raise exception 'Document limit reached (200 documents)' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger learning_documents_limit before insert on public.learning_documents
  for each row execute function public.enforce_learning_documents_limit();
revoke execute on function public.enforce_learning_documents_limit() from public, anon, authenticated;

-- Focus overrides: one row per user and topic, "added" by hand or "removed".
create table public.learning_focus (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_slug text not null check (topic_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(topic_slug) <= 64),
  kind text not null check (kind in ('added', 'removed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_slug)
);
alter table public.learning_focus enable row level security;
create policy "Users read their own focus" on public.learning_focus
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own focus" on public.learning_focus
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own focus" on public.learning_focus
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own focus" on public.learning_focus
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learning_focus from anon, authenticated;
grant select, delete on public.learning_focus to authenticated;
grant insert (topic_slug, kind, updated_at), update (topic_slug, kind, updated_at) on public.learning_focus to authenticated;

-- Upload quota: 10 a day per user, 100 a day for everyone (AI costs money).
create table public.learning_upload_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index learning_upload_usage_created_idx on public.learning_upload_usage (created_at);
alter table public.learning_upload_usage enable row level security;
revoke all on public.learning_upload_usage from anon, authenticated;

create function public.use_upload_quota() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('learning_upload_usage'));
  if (select count(*) from public.learning_upload_usage where user_id = uid and created_at > now() - interval '24 hours') >= 10
     or (select count(*) from public.learning_upload_usage where created_at > now() - interval '24 hours') >= 100 then
    raise exception 'Upload limit reached' using errcode = 'P0001';
  end if;
  insert into public.learning_upload_usage (user_id) values (uid);
end; $$;
revoke execute on function public.use_upload_quota() from public, anon;
grant execute on function public.use_upload_quota() to authenticated;

-- Private bucket for files in transit; each user may only touch <their id>/…
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learning-uploads', 'learning-uploads', false, 10485760, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
]);
create policy "Users upload into their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users read their own uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
