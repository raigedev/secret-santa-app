begin;

alter table public.profiles
  add column if not exists avatar_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_url_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_url_length_check
      check (avatar_url is null or char_length(avatar_url) <= 1000);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'profile_avatars_public_read'
  ) then
    create policy profile_avatars_public_read
      on storage.objects
      for select
      to public
      using (bucket_id = 'profile-avatars');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'profile_avatars_insert_own'
  ) then
    create policy profile_avatars_insert_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'profile_avatars_update_own'
  ) then
    create policy profile_avatars_update_own
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'profile_avatars_delete_own'
  ) then
    create policy profile_avatars_delete_own
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

drop function if exists public.list_group_peer_profiles(uuid);

create function public.list_group_peer_profiles(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_emoji text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_emoji,
    p.avatar_url
  from public.profiles p
  join public.group_members gm
    on gm.user_id = p.user_id
  where gm.group_id = p_group_id
    and gm.status = 'accepted'
    and (
      public.is_group_owner(p_group_id)
      or public.is_group_member(p_group_id)
    );
$$;

revoke all on function public.list_group_peer_profiles(uuid) from public, anon;
grant execute on function public.list_group_peer_profiles(uuid) to authenticated;
grant execute on function public.list_group_peer_profiles(uuid) to service_role;

commit;
