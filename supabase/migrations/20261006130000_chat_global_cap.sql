-- Review fix: OpenRouter's free tier allows 50 requests a day for the whole
-- account, so two users at the per-user limit (25/day) could use it all up.
-- The chat now also stops app-wide at 45 messages per 24 hours, leaving some
-- headroom under OpenRouter's own cap.
-- ponytail: hardcoded 45 matches the free tier; raise it if credits are bought (1,000/day).
create or replace function public.use_chat_quota() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;

  -- One global lock (not per-user) so the app-wide count can't be overshot by
  -- users sending at the same moment.
  perform pg_advisory_xact_lock(hashtext('chat_usage'));

  if (select count(*) from public.chat_usage
        where user_id = uid and created_at > now() - interval '1 minute') >= 10
     or (select count(*) from public.chat_usage
        where user_id = uid and created_at > now() - interval '24 hours') >= 25
     or (select count(*) from public.chat_usage
        where created_at > now() - interval '24 hours') >= 45 then
    raise exception 'Chat limit reached' using errcode = 'P0001';
  end if;

  insert into public.chat_usage (user_id) values (uid);
end;
$$;

-- `create or replace` keeps existing grants, but restate them to be explicit.
revoke execute on function public.use_chat_quota() from public, anon;
grant execute on function public.use_chat_quota() to authenticated;
