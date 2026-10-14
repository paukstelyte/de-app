-- Each answer the browser sends carries its own id (a random UUID made when the
-- learner answers). Retrying a failed save sends the same id again, so the
-- unique index turns a duplicate into an error the server treats as "already
-- saved", and an answer is never counted twice. Older rows have no id (NULLs
-- don't clash in a unique index).
alter table public.attempts add column client_id uuid;
create unique index attempts_user_client_id_key on public.attempts (user_id, client_id);
grant insert (client_id) on public.attempts to authenticated;
