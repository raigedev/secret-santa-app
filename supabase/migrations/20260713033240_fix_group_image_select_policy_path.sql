begin;

drop policy if exists group_images_select_group_members on storage.objects;

create policy group_images_select_group_members
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'group-images'
    and exists (
      select 1
      from public.groups as image_group
      where image_group.id::text = (storage.foldername(storage.objects.name))[2]
        and image_group.owner_id::text = (storage.foldername(storage.objects.name))[1]
        and (
          image_group.owner_id = auth.uid()
          or exists (
            select 1
            from public.group_members as image_member
            where image_member.group_id = image_group.id
              and image_member.user_id = auth.uid()
              and image_member.status = 'accepted'
          )
        )
    )
  );

commit;
