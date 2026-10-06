-- One row per chat message a user sends, used only to rate-limit the AI chat
-- (OpenRouter's free tier is shared by the whole app). Users never touch the
-- table directly: they call use_chat_quota(), which checks the limit and adds
-- the row. That way nobody can back-date, delete or read rows to dodge the limit.
create table public.chat_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create index chat_usage_user_created_idx on public.chat_usage (user_id, created_at);

-- RLS on with no policies, and no privileges: closed to every API role.
alter table public.chat_usage enable row level security;
revoke all on public.chat_usage from anon, authenticated;

-- At most 10 messages per minute and 25 per 24 hours per user.
create function public.use_chat_quota() returns void
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

  -- Two messages sent at the same moment must not both squeeze under the limit.
  perform pg_advisory_xact_lock(hashtext('chat_usage:' || uid::text));

  if (select count(*) from public.chat_usage
        where user_id = uid and created_at > now() - interval '1 minute') >= 10
     or (select count(*) from public.chat_usage
        where user_id = uid and created_at > now() - interval '24 hours') >= 25 then
    raise exception 'Chat limit reached' using errcode = 'P0001';
  end if;

  insert into public.chat_usage (user_id) values (uid);
end;
$$;

revoke execute on function public.use_chat_quota() from public, anon;
grant execute on function public.use_chat_quota() to authenticated;
