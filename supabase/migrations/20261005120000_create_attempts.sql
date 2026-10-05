-- Every answer a logged-in user gives, for every topic. Stats, trouble words
-- and "Practise my mistakes" are all derived from this one append-only table.
create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic text not null,          -- e.g. 'articles'; one value per grammar topic
  item_id text not null,        -- id within the topic's built-in data, e.g. 'seed-12'
  answer text not null,         -- what the user picked, e.g. 'die'
  correct boolean not null,
  created_at timestamptz not null default now()
);

create index attempts_user_topic_created_idx
  on public.attempts (user_id, topic, created_at);

alter table public.attempts enable row level security;

-- (select auth.uid()) is evaluated once per query instead of once per row.
create policy "Users read their own attempts"
  on public.attempts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own attempts"
  on public.attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No update/delete policies: history is append-only. Deleting the account
-- removes the rows through the foreign key's on delete cascade.

-- Signed-out visitors get nothing, even if a policy is later written without
-- `to authenticated`. New tables start closed too (default privileges).
revoke all on public.attempts from anon;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
