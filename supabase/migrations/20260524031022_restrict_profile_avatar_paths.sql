begin;

alter table public.profiles
  drop constraint if exists profiles_avatar_url_storage_owner_check;

alter table public.profiles
  add constraint profiles_avatar_url_storage_owner_check
  check (
    avatar_url is null
    or avatar_url = ''
    or (
      char_length(avatar_url) <= 1000
      and avatar_url ~* (
        '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/profile-avatars/'
        || user_id::text
        || '/avatar-[a-z0-9]+-[a-z0-9]+\.(jpg|png|webp)$'
      )
    )
  )
  not valid;

drop policy if exists profile_avatars_insert_own on storage.objects;
drop policy if exists profile_avatars_update_own on storage.objects;
drop policy if exists profile_avatars_delete_own on storage.objects;

create policy profile_avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and name ~* (
      '^'
      || auth.uid()::text
      || '/avatar-[a-z0-9]+-[a-z0-9]+\.(jpg|png|webp)$'
    )
  );

create policy profile_avatars_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and name ~* (
      '^'
      || auth.uid()::text
      || '/avatar-[a-z0-9]+-[a-z0-9]+\.(jpg|png|webp)$'
    )
  )
  with check (
    bucket_id = 'profile-avatars'
    and name ~* (
      '^'
      || auth.uid()::text
      || '/avatar-[a-z0-9]+-[a-z0-9]+\.(jpg|png|webp)$'
    )
  );

create policy profile_avatars_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and name ~* (
      '^'
      || auth.uid()::text
      || '/avatar-[a-z0-9]+-[a-z0-9]+\.(jpg|png|webp)$'
    )
  );

commit;
