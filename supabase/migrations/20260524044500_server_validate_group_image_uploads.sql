begin;

update storage.buckets
set
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'group-images';

drop policy if exists group_images_insert_own_folder on storage.objects;
drop policy if exists group_images_update_own_folder on storage.objects;
drop policy if exists group_images_delete_own_folder on storage.objects;
drop policy if exists group_images_insert_owned_group on storage.objects;
drop policy if exists group_images_update_owned_group on storage.objects;
drop policy if exists group_images_delete_owned_group on storage.objects;

commit;
