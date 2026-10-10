-- Cross-user privacy check. Changes nothing: everything runs in one transaction
-- that is rolled back at the end.
-- As the admin role it first gives user A (test@test.com) a saved document, a
-- focus row and an uploaded file, so every check below has something to find.
-- Then it acts as user B (test2@test.com) and tries to read, change or delete
-- A's data. Expected: 0 rows, or "refused" (permission denied, 42501).
-- Only permission errors count as "refused"; any other error stops the script.
-- Run: npx supabase db query --linked --project-ref <ref> -f supabase/tests/cross-user-privacy.sql
begin;
create temp table results (check_name text, expected text, result text) on commit drop;
grant all on results to authenticated;

-- Setup, as the admin role.
select set_config('test.user_a', coalesce((select id::text from auth.users where email = 'test@test.com'), ''), true);
select set_config('test.user_b', coalesce((select id::text from auth.users where email = 'test2@test.com'), ''), true);
insert into results values ('setup: both test users exist', 'yes',
  case when current_setting('test.user_a') <> '' and current_setting('test.user_b') <> '' then 'yes' else 'no' end);
insert into public.learning_documents (user_id, title, extracted_text, suggestions)
  values (current_setting('test.user_a')::uuid, 'Privacy test document', 'mit dem Bus', '[{"slug":"dative-case","reason":"r","fromMistake":false}]');
insert into public.learning_focus (user_id, topic_slug, kind)
  values (current_setting('test.user_a')::uuid, 'privacy-test-topic', 'added')
  on conflict (user_id, topic_slug) do nothing;
insert into storage.objects (bucket_id, name)
  values ('learning-uploads', current_setting('test.user_a') || '/privacy-test/0.pdf');
insert into results select 'setup: A has documents', '> 0', count(*)::text from public.learning_documents where user_id = current_setting('test.user_a')::uuid;
insert into results select 'setup: A has focus rows', '> 0', count(*)::text from public.learning_focus where user_id = current_setting('test.user_a')::uuid;
insert into results select 'setup: A has saved answers', '> 0', count(*)::text from public.attempts where user_id = current_setting('test.user_a')::uuid;
insert into results select 'setup: A has an uploaded file', '> 0', count(*)::text from storage.objects where bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = current_setting('test.user_a');

-- Now act as B.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare a uuid := current_setting('test.user_a')::uuid; n bigint;
begin
  insert into results values ('B is signed in as B', 'yes', case when auth.uid() = current_setting('test.user_b')::uuid then 'yes' else 'no' end);

  -- Reading: row-level security hides other users' rows.
  select count(*) into n from public.learning_documents where user_id = a;
  insert into results values ('B reads A''s documents (AI outputs)', '0', n::text);
  select count(*) into n from public.learning_focus where user_id = a;
  insert into results values ('B reads A''s focus list', '0', n::text);
  select count(*) into n from public.attempts where user_id = a;
  insert into results values ('B reads A''s answers', '0', n::text);
  select count(*) into n from storage.objects where bucket_id = 'learning-uploads' and (storage.foldername(name))[1] = a::text;
  insert into results values ('B lists A''s uploaded files', '0', n::text);

  -- Changing: row-level security limits update/delete to B's own rows.
  update public.learning_focus set kind = 'removed' where user_id = a; get diagnostics n = row_count;
  insert into results values ('B changes A''s focus list (RLS on update)', '0', n::text);
  delete from public.learning_documents where user_id = a; get diagnostics n = row_count;
  insert into results values ('B deletes A''s documents (RLS on delete)', '0', n::text);
  -- (Deleting files with SQL is blocked for everyone by Supabase; file deletes go
  -- through the Storage API, where the same own-folder policy applies.)

  -- Refused outright by grants (no permission at all).
  begin select count(*) into n from public.learning_upload_usage;
    insert into results values ('B reads the upload counter (no grant)', 'refused', n::text);
  exception when insufficient_privilege then insert into results values ('B reads the upload counter (no grant)', 'refused', 'refused ' || sqlstate); end;
  begin insert into public.learning_focus (user_id, topic_slug, kind) values (a, 'dative-case', 'added');
    insert into results values ('B writes a row tagged with A''s id (no grant on user_id)', 'refused', 'accepted');
  exception when insufficient_privilege then insert into results values ('B writes a row tagged with A''s id (no grant on user_id)', 'refused', 'refused ' || sqlstate); end;
end $$;

reset role;
-- A's data is untouched after B's attempts (still inside the transaction).
insert into results select 'after: A''s document still there', '1', count(*)::text from public.learning_documents where user_id = current_setting('test.user_a')::uuid and title = 'Privacy test document';
insert into results select 'after: A''s uploaded file still there', '1', count(*)::text from storage.objects where bucket_id = 'learning-uploads' and name = current_setting('test.user_a') || '/privacy-test/0.pdf';

select * from results;
rollback;
