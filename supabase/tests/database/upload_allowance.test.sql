-- The upload allowance: 10 uploads per learner and 100 for everyone in 24 hours, the next-free
-- time, a given-back upload freeing a slot, no self-refunds, and no access for signed-out
-- visitors. Runs on the local throwaway database (npm run test:db); rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated');
delete from public.learning_upload_usage;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select user_left, user_limit, next_free_at from public.upload_allowance()',
  $$values (10, 10, null::timestamptz)$$, 'a fresh learner has 10 of 10 uploads and no wait');
select cmp_ok(public.use_upload_quota(), '>', 0::bigint, 'use_upload_quota returns the new row id');
select public.use_upload_quota() from generate_series(1, 2);
select is((select user_left from public.upload_allowance()), 7, 'after 3 uploads, 7 are left');
select public.use_upload_quota() from generate_series(1, 7);
select is((select user_left from public.upload_allowance()), 0, 'after 10 uploads, none are left');
select ok((select next_free_at between now() + interval '23 hours' and now() + interval '24 hours' from public.upload_allowance()),
  'after 10 uploads, the next one frees up about 24 hours later');
select throws_ok('select public.use_upload_quota()', 'P0001', null, 'the 11th upload is refused');
select throws_ok('delete from public.learning_upload_usage', '42501', null, 'a learner can''t give uploads back to themselves');
reset role;

-- The server (admin role) gives one back.
delete from public.learning_upload_usage where id = (select min(id) from public.learning_upload_usage);
set local role authenticated;
select is((select user_left from public.upload_allowance()), 1, 'a given-back upload frees one slot');
reset role;

-- The shared limit: B fills it to 100 (A has 9).
insert into public.learning_upload_usage (user_id) select '00000000-0000-0000-0000-00000000000b' from generate_series(1, 91);
set local role authenticated;
select results_eq('select shared_left, user_left, next_free_at is not null from public.upload_allowance()',
  $$values (0, 1, true)$$, 'when the shared limit is full, nobody can upload and a wait time is shown');
reset role;

set local role anon;
select throws_ok('select * from public.upload_allowance()', '42501', null, 'signed-out visitors can''t read the allowance');
select throws_ok('select public.use_upload_quota()', '42501', null, 'signed-out visitors can''t use an upload');
reset role;

select * from finish();
rollback;
