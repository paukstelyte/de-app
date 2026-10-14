-- Cross-user privacy: user B can't read, change or delete user A's documents, focus list,
-- answers, upload counter or files. Runs on the local throwaway database (npm run test:db);
-- everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Two users that exist only inside this transaction.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated');

-- A's data, written as the admin role.
insert into public.learning_documents (user_id, title, extracted_text, suggestions)
  values ('00000000-0000-0000-0000-00000000000a', 'Privacy test document', 'mit dem Bus', '[{"slug":"dative-case","reason":"r","fromMistake":false}]');
insert into public.learning_focus (user_id, topic_slug, kind) values ('00000000-0000-0000-0000-00000000000a', 'dative-case', 'added');
insert into public.attempts (user_id, topic, item_id, answer, correct) values ('00000000-0000-0000-0000-00000000000a', 'articles', 'seed-1', 'der', true);
insert into public.learning_upload_usage (user_id) values ('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('learning-uploads', '00000000-0000-0000-0000-00000000000a/privacy-test/0.pdf');

-- As A: the owner policies work (not just "nobody can read").
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.learning_documents)::int, 1, 'A reads their own documents');
select is((select count(*) from public.learning_upload_usage)::int, 1, 'A reads their own upload counter');
select is((select count(*) from public.attempts)::int, 1, 'A reads their own answers');
reset role;

-- As B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is(auth.uid(), '00000000-0000-0000-0000-00000000000b'::uuid, 'B is signed in as B');
select is_empty('select 1 from public.learning_documents', 'B reads none of A''s documents (AI outputs)');
select is_empty('select 1 from public.learning_focus', 'B reads none of A''s focus list');
select is_empty('select 1 from public.attempts', 'B reads none of A''s answers');
select is_empty('select 1 from public.learning_upload_usage', 'B reads none of A''s upload counter');
select is_empty($$select 1 from storage.objects where bucket_id = 'learning-uploads'$$, 'B lists none of A''s uploaded files');
select results_eq(
  $$with c as (update public.learning_focus set kind = 'removed' returning 1) select count(*)::int from c$$,
  array[0], 'B changes none of A''s focus rows');
select results_eq(
  'with d as (delete from public.learning_documents returning 1) select count(*)::int from d',
  array[0], 'B deletes none of A''s documents');
select throws_ok('delete from public.learning_upload_usage', '42501', null, 'B can''t delete upload counter rows (no grant)');
select throws_ok(
  $$insert into public.learning_focus (user_id, topic_slug, kind) values ('00000000-0000-0000-0000-00000000000a', 'dative-case', 'added')$$,
  '42501', null, 'B can''t write a row tagged with A''s id (no grant on user_id)');
select throws_ok(
  $$insert into public.attempts (user_id, topic, item_id, answer, correct) values ('00000000-0000-0000-0000-00000000000a', 'articles', 'seed-1', 'der', true)$$,
  '42501', null, 'B can''t save an answer as A');
select throws_ok(
  $$insert into public.learning_documents (title, extracted_text, suggestions) values ('x', 'y', '[]')$$,
  '42501', null, 'B can''t save a document directly (only the server, after a counted AI read)');
reset role;

-- A's data is untouched.
select is((select count(*) from public.learning_documents where title = 'Privacy test document')::int, 1, 'A''s document is still there');
select is((select kind from public.learning_focus where user_id = '00000000-0000-0000-0000-00000000000a'), 'added', 'A''s focus row is unchanged');
select is((select count(*) from storage.objects where name = '00000000-0000-0000-0000-00000000000a/privacy-test/0.pdf')::int, 1, 'A''s file is still there');

-- Signed-out visitors read nothing at all.
set local role anon;
select throws_ok('select 1 from public.learning_documents', '42501', null, 'anon can''t read documents');
reset role;

select * from finish();
rollback;
