-- Security audit follow-ups. RLS already limits users to their own rows, but a
-- logged-in user can still bypass the app and insert straight through the API,
-- so the table itself now bounds what one user can write.

-- 1. Bounded values: no multi-megabyte strings filling the database. Lengths
--    rather than fixed value lists, so future topics need no migration.
alter table public.attempts
  add constraint attempts_topic_len check (char_length(topic) between 1 and 32),
  add constraint attempts_item_id_len check (char_length(item_id) between 1 and 64),
  add constraint attempts_answer_len check (char_length(answer) between 1 and 64);

-- 2. Rate limit: at most 120 answers per user per minute (a fast human manages
--    ~30). Row-level BEFORE triggers see rows inserted earlier in the same
--    statement, so one huge bulk insert is capped too.
create function public.attempts_rate_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.attempts
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 120 then
    raise exception 'Too many answers in the last minute' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.attempts_rate_limit() from public, anon, authenticated;

create trigger attempts_rate_limit
  before insert on public.attempts
  for each row execute function public.attempts_rate_limit();

-- 3. Logged-in users only ever read and add rows; drop the table privileges
--    nothing uses. (TRUNCATE in particular ignores RLS.)
revoke update, delete, truncate, references, trigger on public.attempts from authenticated;

-- 4. Functions created in public later must not be callable by signed-out
--    visitors by default (tables and sequences were already closed).
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
