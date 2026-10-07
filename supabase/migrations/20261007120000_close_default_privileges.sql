-- Security scan follow-ups (2026-10-07).

-- 1. New tables, sequences and functions in public no longer give logged-in
--    users anything by default. Earlier migrations closed these for signed-out
--    visitors (anon) only, so every new table handed `authenticated` full
--    privileges, including TRUNCATE, which ignores RLS. From now on each
--    migration grants exactly what the app uses (see docs/supabase-schema.md).
alter default privileges for role postgres in schema public
  revoke all on tables from authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from authenticated;

-- 2. rls_auto_enable() is created by Supabase (the "auto-enable RLS" setting)
--    to power the ensure_rls event trigger. It's security definer and was
--    executable through the API. Postgres can't call an event-trigger function
--    directly, so this is tidy-up, not a live hole. Guarded because the local
--    stack doesn't have it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
