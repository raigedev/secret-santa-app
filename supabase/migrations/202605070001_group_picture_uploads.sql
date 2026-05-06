begin;

alter table public.groups
  add column if not exists image_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'groups_image_url_length_check'
  ) then
    alter table public.groups
      add constraint groups_image_url_length_check
      check (image_url is null or char_length(image_url) <= 1000);
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-images',
  'group-images',
  true,
  2097152,
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
      and policyname = 'group_images_insert_own_folder'
  ) then
    create policy group_images_insert_own_folder
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'group-images'
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
      and policyname = 'group_images_update_own_folder'
  ) then
    create policy group_images_update_own_folder
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'group-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'group-images'
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
      and policyname = 'group_images_delete_own_folder'
  ) then
    create policy group_images_delete_own_folder
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'group-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

commit;
