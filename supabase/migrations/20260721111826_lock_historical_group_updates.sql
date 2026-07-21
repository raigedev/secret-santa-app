begin;

-- Keep concluded exchanges immutable after the same seven-day wrap-up window
-- used by the application History view. Deletion remains a separate owner action.
alter policy groups_update_for_owner
  on public.groups
  using (
    owner_id = (select auth.uid())
    and (
      event_date is null
      or event_date > (timezone('utc'::text, now()))::date - 7
    )
  )
  with check (
    owner_id = (select auth.uid())
    and (
      event_date is null
      or event_date > (timezone('utc'::text, now()))::date - 7
    )
  );

alter policy group_draw_exclusions_insert_for_owner
  on public.group_draw_exclusions
  with check (
    (select private.is_group_owner(group_id))
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.groups as writable_group
      where writable_group.id = group_draw_exclusions.group_id
        and (
          writable_group.event_date is null
          or writable_group.event_date > (timezone('utc'::text, now()))::date - 7
        )
    )
  );

alter policy group_draw_exclusions_delete_for_owner
  on public.group_draw_exclusions
  using (
    (select private.is_group_owner(group_id))
    and exists (
      select 1
      from public.groups as writable_group
      where writable_group.id = group_draw_exclusions.group_id
        and (
          writable_group.event_date is null
          or writable_group.event_date > (timezone('utc'::text, now()))::date - 7
        )
    )
  );

commit;
