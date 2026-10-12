-- Upload allowance check. Changes nothing: everything runs in one transaction that is rolled back.
-- As user A (test@test.com) it checks upload_allowance() and use_upload_quota(): counts, the
-- next-free time, the 11th upload refused, a given-back upload freeing a slot, the shared limit,
-- and that signed-out visitors (anon) can't call either function.
-- Run: npx supabase db query --linked --project-ref <ref> -f supabase/tests/upload-allowance.sql
begin;
create temp table results (check_name text, expected text, result text) on commit drop;
grant all on results to authenticated, anon;

select set_config('test.user_a', (select id::text from auth.users where email = 'test@test.com'), true);
select set_config('test.user_b', (select id::text from auth.users where email = 'test2@test.com'), true);
delete from public.learning_upload_usage;   -- clean slate (rolled back at the end)

select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare first_id bigint; r record; refused text := 'no';
begin
  select * into r from public.upload_allowance();
  insert into results values ('fresh: uploads left', '10 of 10, none', r.user_left || ' of ' || r.user_limit || ', ' || coalesce(r.next_free_at::text, 'none'));

  first_id := public.use_upload_quota();
  perform public.use_upload_quota(); perform public.use_upload_quota();
  select * into r from public.upload_allowance();
  insert into results values ('after 3 uploads: left', '7', r.user_left::text);
  insert into results values ('use_upload_quota returns an id', 'yes', case when first_id > 0 then 'yes' else 'no' end);

  for i in 1..7 loop perform public.use_upload_quota(); end loop;
  select * into r from public.upload_allowance();
  insert into results values ('after 10 uploads: left', '0', r.user_left::text);
  insert into results values ('after 10 uploads: next free time is about 24h away', 'yes',
    case when r.next_free_at > now() + interval '23 hours' and r.next_free_at <= now() + interval '24 hours' then 'yes' else 'no' end);

  begin perform public.use_upload_quota(); exception when sqlstate 'P0001' then refused := 'refused P0001'; end;
  insert into results values ('11th upload', 'refused P0001', refused);
  perform set_config('test.first_id', first_id::text, true);
end $$;

-- A given-back upload (admin key) frees one slot.
reset role;
delete from public.learning_upload_usage where id = current_setting('test.first_id')::bigint;
set local role authenticated;
insert into results select 'after giving one back: left', '1', user_left::text from public.upload_allowance();

-- Shared limit: 100 uploads by everyone, A has 9 of their own.
reset role;
insert into public.learning_upload_usage (user_id) select current_setting('test.user_b')::uuid from generate_series(1, 91);
set local role authenticated;
insert into results select 'shared limit full: shared left / A left / wait time set', '0 / 1 / yes',
  shared_left || ' / ' || user_left || ' / ' || case when next_free_at is not null then 'yes' else 'no' end from public.upload_allowance();

-- A signed-in user can't delete (give back) their own uploads through the API.
do $$
declare d text := 'allowed';
begin
  begin delete from public.learning_upload_usage; exception when insufficient_privilege then d := 'refused 42501'; end;
  insert into results values ('A deletes usage rows directly (no self-refund)', 'refused 42501', d);
end $$;

-- Signed out.
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
declare a text := 'allowed'; b text := 'allowed';
begin
  begin perform * from public.upload_allowance(); exception when insufficient_privilege then a := 'refused 42501'; end;
  begin perform public.use_upload_quota(); exception when insufficient_privilege then b := 'refused 42501'; end;
  insert into results values ('anon calls upload_allowance', 'refused 42501', a);
  insert into results values ('anon calls use_upload_quota', 'refused 42501', b);
end $$;

reset role;
select check_name, expected, result, case when expected = result then 'ok' else 'FAIL' end as status from results;
rollback;
