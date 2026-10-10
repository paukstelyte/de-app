-- Cross-user privacy check (read-only, rolled back).
-- Signed in as user B (test2@test.com), try to reach user A's (test@test.com)
-- saved AI outputs, focus list, answers and upload files. Every check should
-- see 0 rows or be refused outright, while A's own rows do exist.
-- Run: npx supabase db query --linked --project-ref <ref> -f supabase/tests/cross-user-privacy.sql
begin;
create temp table results (check_name text, expected text, result text) on commit drop;
grant all on results to authenticated;

-- As the admin role: A really has data, so a 0 below means "hidden", not "empty".
insert into results select 'A has saved answers (admin view)', '> 0',
  count(*)::text from public.attempts where user_id = (select id from auth.users where email = 'test@test.com');
insert into results select 'A has focus rows (admin view)', '> 0',
  count(*)::text from public.learning_focus where user_id = (select id from auth.users where email = 'test@test.com');
insert into results select 'Documents saved by users other than B (admin view)', 'any',
  count(*)::text from public.learning_documents where user_id <> (select id from auth.users where email = 'test2@test.com');

-- Remember A's id before switching role (users can't read auth.users).
select set_config('test.user_a', (select id::text from auth.users where email = 'test@test.com'), true);

-- Now act as B.
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'test2@test.com'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare a uuid := current_setting('test.user_a')::uuid; n bigint;
begin
  begin select count(*) into n from public.learning_documents where user_id <> auth.uid();
    insert into results values ('B reads other users'' documents (AI outputs)', '0', n::text);
  exception when others then insert into results values ('B reads other users'' documents (AI outputs)', '0', 'refused ' || sqlstate); end;
  begin select count(*) into n from public.learning_focus where user_id <> auth.uid();
    insert into results values ('B reads other users'' focus lists', '0', n::text);
  exception when others then insert into results values ('B reads other users'' focus lists', '0', 'refused ' || sqlstate); end;
  begin select count(*) into n from public.attempts where user_id = a;
    insert into results values ('B reads A''s answers', '0', n::text);
  exception when others then insert into results values ('B reads A''s answers', '0', 'refused ' || sqlstate); end;
  begin select count(*) into n from public.learning_upload_usage;
    insert into results values ('B reads the upload counter', 'refused', n::text);
  exception when others then insert into results values ('B reads the upload counter', 'refused', 'refused ' || sqlstate); end;
  begin select count(*) into n from storage.objects where bucket_id = 'learning-uploads' and (storage.foldername(name))[1] <> auth.uid()::text;
    insert into results values ('B lists files in other users'' upload folders', '0', n::text);
  exception when others then insert into results values ('B lists files in other users'' upload folders', '0', 'refused ' || sqlstate); end;
  begin delete from public.learning_documents where user_id = a; get diagnostics n = row_count;
    insert into results values ('B deletes A''s documents', '0', n::text);
  exception when others then insert into results values ('B deletes A''s documents', '0', 'refused ' || sqlstate); end;
  begin insert into public.learning_focus (user_id, topic_slug, kind) values (a, 'dative-case', 'added');
    insert into results values ('B adds to A''s focus list', 'refused', 'accepted');
  exception when others then insert into results values ('B adds to A''s focus list', 'refused', 'refused ' || sqlstate); end;
end $$;

select * from results;
rollback;
