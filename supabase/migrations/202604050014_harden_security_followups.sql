begin;

-- Remove the legacy raw invite email cache from groups. Pending invite emails
-- already live in group_members, so keeping a second copy on groups leaks
-- unnecessary PII through the groups row.
alter table public.groups
  drop column if exists invites;

-- Tighten wishlist links so a short non-http scheme cannot bypass the protocol
-- check just by being under the max length.
alter table public.wishlists
  drop constraint if exists wishlists_item_link_protocol_check;

alter table public.wishlists
  add constraint wishlists_item_link_protocol_check
  check (
    item_link is null
    or item_link = ''
    or (
      char_length(item_link) <= 500
      and item_link ~* '^https?://'
    )
  );

-- Group membership lookups sit on the hot path for RLS helpers and dashboard
-- queries. These composite indexes reduce repeated scans substantially.
create index if not exists group_members_group_user_status_idx
  on public.group_members (group_id, user_id, status);

create index if not exists group_members_group_email_status_idx
  on public.group_members (group_id, email, status);

create index if not exists group_members_user_status_idx
  on public.group_members (user_id, status);

-- Make invite-link access rules explicit instead of relying on service-role
-- paths only. Owners can manage links; regular members cannot.
grant select, insert, update, delete on table public.group_invite_links to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_invite_links'
      and policyname = 'group_invite_links_select_for_owner'
  ) then
    create policy group_invite_links_select_for_owner
      on public.group_invite_links
      for select
      to authenticated
      using (public.is_group_owner(group_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_invite_links'
      and policyname = 'group_invite_links_insert_for_owner'
  ) then
    create policy group_invite_links_insert_for_owner
      on public.group_invite_links
      for insert
      to authenticated
      with check (
        public.is_group_owner(group_id)
        and created_by = auth.uid()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_invite_links'
      and policyname = 'group_invite_links_update_for_owner'
  ) then
    create policy group_invite_links_update_for_owner
      on public.group_invite_links
      for update
      to authenticated
      using (public.is_group_owner(group_id))
      with check (public.is_group_owner(group_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_invite_links'
      and policyname = 'group_invite_links_delete_for_owner'
  ) then
    create policy group_invite_links_delete_for_owner
      on public.group_invite_links
      for delete
      to authenticated
      using (public.is_group_owner(group_id));
  end if;
end;
$$;

-- Receivers should not be able to query their assignment row and discover the
-- giver before the group has been revealed. Givers keep access to their own
-- outgoing assignment at all times.
drop policy if exists assignments_select_for_participants on public.assignments;

create policy assignments_select_for_participants
  on public.assignments
  for select
  to authenticated
  using (
    giver_id = auth.uid()
    or (
      receiver_id = auth.uid()
      and exists (
        select 1
        from public.groups g
        where g.id = assignments.group_id
          and g.revealed = true
      )
    )
  );

-- The owner report no longer depends on this view. Keep it for admin/SQL use,
-- but do not expose click_token / target_url through authenticated client access.
revoke select on public.affiliate_performance from authenticated;

commit;
