-- Keep the upload counter small: the limits only look at the last 24 hours, so
-- each successful call to use_upload_quota() now also deletes rows older than 2 days
-- (a call refused at the limit rolls back, delete included; the next one cleans up).
-- Same checks, limits, lock and grants as before (20261010100000).
create or replace function public.use_upload_quota() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('learning_upload_usage'));
  delete from public.learning_upload_usage where created_at < now() - interval '2 days';
  if (select count(*) from public.learning_upload_usage where user_id = uid and created_at > now() - interval '24 hours') >= 10
     or (select count(*) from public.learning_upload_usage where created_at > now() - interval '24 hours') >= 100 then
    raise exception 'Upload limit reached' using errcode = 'P0001';
  end if;
  insert into public.learning_upload_usage (user_id) values (uid);
end; $$;
