-- Give the upload counter an owner-scoped policy like every other table with user data:
-- a signed-in user may read only their own upload rows (their own upload times). It reveals
-- nothing new (upload_allowance() already tells them how many they have left) and adds no write
-- access: inserts still go only through use_upload_quota(), deletes only through the server's
-- admin key. Signed-out visitors (anon) still have no access at all.

create policy "Users read their own upload usage" on public.learning_upload_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.learning_upload_usage to authenticated;
