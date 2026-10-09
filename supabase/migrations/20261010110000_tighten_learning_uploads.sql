-- Tighten uploads to the learning-uploads bucket.
-- Before: any logged-in user could upload unlimited files (10 MB each) into their own
-- folder, with any name, without ever calling the analyseUpload server action.
-- After: an insert must also (1) match the path shape the server accepts
-- (<uid>/<batch>/<digit>.<allowed ext>, same as ownedPaths in lib/learning/uploads.ts)
-- and (2) leave the user's folder with at most 5 objects (MAX_PHOTOS).
-- The app deletes leftovers before each upload (UploadBox) and on account deletion.
-- The count lives in a security definer function: a policy on storage.objects that
-- queries storage.objects directly fails with "infinite recursion detected in policy".
create function public.learning_upload_count() returns bigint
  language sql stable security definer set search_path = ''
  as $$
    select count(*) from storage.objects
    where bucket_id = 'learning-uploads'
      and (storage.foldername(name))[1] = (select auth.uid())::text
  $$;
revoke all on function public.learning_upload_count() from public, anon;
grant execute on function public.learning_upload_count() to authenticated;

drop policy "Users upload into their own folder" on storage.objects;
create policy "Users upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learning-uploads'
    and name ~ ('^' || (select auth.uid())::text || '/[A-Za-z0-9-]{1,64}/[0-9]\.(pdf|docx|jpg|jpeg|png|webp|heic|heif)$')
    and (select public.learning_upload_count()) < 5
  );
