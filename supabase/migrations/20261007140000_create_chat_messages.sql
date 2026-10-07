-- Saved AI chat conversation: each user's current conversation, so it survives
-- a page reload. "New chat" deletes it; deleting the account cascades.
-- The app still sends the conversation from the browser with every message;
-- this table only restores it after a reload.
create table public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  persona text check (persona is null or char_length(persona) <= 32),
  created_at timestamptz not null default now()
);

create index chat_messages_user_id_idx on public.chat_messages (user_id, id);

alter table public.chat_messages enable row level security;

-- Users read and delete only their own messages. They can't insert or edit
-- directly: rows are added only through save_chat_turn() below, which caps how
-- many each user keeps.
create policy "Users read their own chat messages"
  on public.chat_messages for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users delete their own chat messages"
  on public.chat_messages for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.chat_messages from anon, authenticated;
grant select, delete on public.chat_messages to authenticated;

-- Saves one question and its reply for the caller, then keeps only their
-- newest 100 messages so storage stays bounded even if called directly.
create function public.save_chat_turn(user_text text, reply text, persona text)
returns void
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

  insert into public.chat_messages (user_id, role, content, persona)
  values (uid, 'user', user_text, null),
         (uid, 'assistant', reply, persona);

  delete from public.chat_messages
  where user_id = uid
    and id not in (
      select id from public.chat_messages
      where user_id = uid
      order by id desc
      limit 100
    );
end;
$$;

revoke execute on function public.save_chat_turn(text, text, text) from public, anon;
grant execute on function public.save_chat_turn(text, text, text) to authenticated;
