begin;

update storage.buckets
set public = false
where id = 'group-images';

update public.groups
set image_url = regexp_replace(
  image_url,
  '^https?://[^/]+/storage/v1/object/(public|sign)/group-images/',
  ''
)
where image_url ~ '^https?://[^/]+/storage/v1/object/(public|sign)/group-images/';

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'group_images_insert_own_folder'
  ) then
    drop policy group_images_insert_own_folder on storage.objects;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'group_images_update_own_folder'
  ) then
    drop policy group_images_update_own_folder on storage.objects;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'group_images_delete_own_folder'
  ) then
    drop policy group_images_delete_own_folder on storage.objects;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'group_images_select_group_members'
  ) then
    create policy group_images_select_group_members
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'group-images'
        and exists (
          select 1
          from public.groups g
          where g.id::text = (storage.foldername(name))[2]
            and (
              g.owner_id = auth.uid()
              or exists (
                select 1
                from public.group_members gm
                where gm.group_id = g.id
                  and gm.user_id = auth.uid()
                  and gm.status = 'accepted'
              )
            )
        )
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
      and policyname = 'group_images_insert_owned_group'
  ) then
    create policy group_images_insert_owned_group
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'group-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and exists (
          select 1
          from public.groups g
          where g.id::text = (storage.foldername(name))[2]
            and g.owner_id = auth.uid()
        )
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
      and policyname = 'group_images_update_owned_group'
  ) then
    create policy group_images_update_owned_group
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'group-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and exists (
          select 1
          from public.groups g
          where g.id::text = (storage.foldername(name))[2]
            and g.owner_id = auth.uid()
        )
      )
      with check (
        bucket_id = 'group-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and exists (
          select 1
          from public.groups g
          where g.id::text = (storage.foldername(name))[2]
            and g.owner_id = auth.uid()
        )
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
      and policyname = 'group_images_delete_owned_group'
  ) then
    create policy group_images_delete_owned_group
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'group-images'
        and (storage.foldername(name))[1] = auth.uid()::text
        and exists (
          select 1
          from public.groups g
          where g.id::text = (storage.foldername(name))[2]
            and g.owner_id = auth.uid()
        )
      );
  end if;
end $$;

commit;
