-- Show learners how many uploads they have left, and give an upload back when the AI read fails.
--
-- 1. use_upload_quota() now returns the id of the row it recorded, so the server can give that
--    upload back (with the admin key; there is deliberately no refund function users can call).
--    Same checks, limits, lock, cleanup and grants as before (20261010130000).
-- 2. upload_allowance() tells the caller how many uploads they and everyone have left in the
--    rolling 24 hours, and when the next slot frees up. Only the caller's own numbers and the
--    shared total are returned, never other users' rows.

drop function public.use_upload_quota();
create function public.use_upload_quota() returns bigint
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_id bigint;
begin
  if uid is null then raise exception 'Not logged in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('learning_upload_usage'));
  delete from public.learning_upload_usage where created_at < now() - interval '2 days';
  if (select count(*) from public.learning_upload_usage where user_id = uid and created_at > now() - interval '24 hours') >= 10
     or (select count(*) from public.learning_upload_usage where created_at > now() - interval '24 hours') >= 100 then
    raise exception 'Upload limit reached' using errcode = 'P0001';
  end if;
  insert into public.learning_upload_usage (user_id) values (uid) returning id into new_id;
  return new_id;
end; $$;
revoke execute on function public.use_upload_quota() from public, anon;
grant execute on function public.use_upload_quota() to authenticated;

create function public.upload_allowance()
returns table (user_left int, user_limit int, shared_left int, next_free_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select count(*)::int as n, min(created_at) as oldest from public.learning_upload_usage
    where user_id = auth.uid() and created_at > now() - interval '24 hours'
  ), everyone as (
    select count(*)::int as n, min(created_at) as oldest from public.learning_upload_usage
    where created_at > now() - interval '24 hours'
  )
  select greatest(10 - mine.n, 0), 10, greatest(100 - everyone.n, 0),
         case when mine.n >= 10 then mine.oldest + interval '24 hours'
              when everyone.n >= 100 then everyone.oldest + interval '24 hours' end
  from mine, everyone
  where auth.uid() is not null;
$$;
revoke execute on function public.upload_allowance() from public, anon;
grant execute on function public.upload_allowance() to authenticated;
