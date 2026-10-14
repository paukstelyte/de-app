-- Each saved answer carries the id the browser gave it; the same id twice is refused, so a
-- retried save can never count an answer twice. Rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.attempts (topic, item_id, answer, correct, client_id)
  values ('articles', 'seed-1', 'der', true, '11111111-1111-1111-1111-111111111111')$$, 'an answer is saved with its id');
select throws_ok($$insert into public.attempts (topic, item_id, answer, correct, client_id)
  values ('articles', 'seed-1', 'der', true, '11111111-1111-1111-1111-111111111111')$$, '23505', null, 'the same answer id again is refused');
select lives_ok($$insert into public.attempts (topic, item_id, answer, correct) values ('articles', 'seed-2', 'die', false)$$,
  'answers without an id (older clients) are still saved');
reset role;

-- Another learner may use the same id (ids are unique per learner).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.attempts (topic, item_id, answer, correct, client_id)
  values ('articles', 'seed-1', 'der', true, '11111111-1111-1111-1111-111111111111')$$, 'another learner''s answer with the same id is saved');
reset role;

select * from finish();
rollback;
