-- Mirror the production RLS performance hardening applied manually on
-- 2026-04-30 while migration history is being reconciled.

create index if not exists groups_owner_created_idx
  on public.groups (owner_id, created_at desc);

create index if not exists group_members_user_status_group_idx
  on public.group_members (user_id, status, group_id);

create index if not exists group_members_group_status_user_idx
  on public.group_members (group_id, status, user_id);

create index if not exists assignments_giver_group_idx
  on public.assignments (giver_id, group_id);

create index if not exists assignments_receiver_group_idx
  on public.assignments (receiver_id, group_id);

create index if not exists wishlists_user_group_created_idx
  on public.wishlists (user_id, group_id, created_at desc);

create index if not exists wishlists_group_user_created_idx
  on public.wishlists (group_id, user_id, created_at desc);

create index if not exists notifications_user_type_created_idx
  on public.notifications (user_id, type, created_at desc);

create index if not exists notifications_user_unread_created_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter policy affiliate_clicks_select_for_owner
  on public.affiliate_clicks
  using (user_id = (select auth.uid()));

alter policy affiliate_conversions_select_for_owner
  on public.affiliate_conversions
  using (
    affiliate_click_id is not null
    and exists (
      select 1
      from public.affiliate_clicks
      where affiliate_clicks.id = affiliate_conversions.affiliate_click_id
        and affiliate_clicks.user_id = (select auth.uid())
    )
  );

alter policy assignments_delete_for_owner
  on public.assignments
  using ((select private.is_group_owner(group_id)));

alter policy assignments_insert_for_owner
  on public.assignments
  with check ((select private.is_group_owner(group_id)));

alter policy assignments_select_for_participants
  on public.assignments
  using (
    giver_id = (select auth.uid())
    or (
      receiver_id = (select auth.uid())
      and exists (
        select 1
        from public.groups g
        where g.id = assignments.group_id
          and g.revealed = true
      )
    )
  );

alter policy group_draw_cycle_pairs_select_for_owner
  on public.group_draw_cycle_pairs
  using ((select private.is_group_owner(group_id)));

alter policy group_draw_cycles_select_for_owner
  on public.group_draw_cycles
  using ((select private.is_group_owner(group_id)));

alter policy group_draw_exclusions_delete_for_owner
  on public.group_draw_exclusions
  using ((select private.is_group_owner(group_id)));

alter policy group_draw_exclusions_insert_for_owner
  on public.group_draw_exclusions
  with check (
    (select private.is_group_owner(group_id))
    and created_by = (select auth.uid())
  );

alter policy group_draw_exclusions_select_for_owner
  on public.group_draw_exclusions
  using ((select private.is_group_owner(group_id)));

alter policy group_draw_resets_select_for_owner
  on public.group_draw_resets
  using ((select private.is_group_owner(group_id)));

alter policy group_members_delete_for_owner_or_self
  on public.group_members
  using (
    (select private.is_group_owner(group_id))
    or user_id = (select auth.uid())
  );

alter policy group_members_insert_for_owner
  on public.group_members
  with check ((select private.is_group_owner(group_id)));

alter policy group_members_select_visible_rows
  on public.group_members
  using (
    (select private.is_group_owner(group_id))
    or (select private.is_group_member(group_id))
    or user_id = (select auth.uid())
    or lower(coalesce(email, '')) = (select private.current_user_email())
  );

alter policy group_reveal_sessions_insert_for_owner
  on public.group_reveal_sessions
  with check ((select private.is_group_owner(group_id)));

alter policy group_reveal_sessions_select_for_members
  on public.group_reveal_sessions
  using (
    (select private.is_group_owner(group_id))
    or (select private.is_group_member(group_id))
  );

alter policy group_reveal_sessions_update_for_owner
  on public.group_reveal_sessions
  using ((select private.is_group_owner(group_id)))
  with check ((select private.is_group_owner(group_id)));

alter policy groups_delete_for_owner
  on public.groups
  using (owner_id = (select auth.uid()));

alter policy groups_insert_for_owner
  on public.groups
  with check (owner_id = (select auth.uid()));

alter policy groups_select_for_members
  on public.groups
  using (
    (select private.is_group_owner(id))
    or (select private.is_group_member_or_invited(id))
  );

alter policy groups_update_for_owner
  on public.groups
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

alter policy messages_insert_for_thread_participants
  on public.messages
  with check (
    sender_id = (select auth.uid())
    and (
      thread_giver_id = (select auth.uid())
      or thread_receiver_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.assignments a
      where a.group_id = messages.group_id
        and a.giver_id = messages.thread_giver_id
        and a.receiver_id = messages.thread_receiver_id
    )
  );

alter policy messages_select_for_thread_participants
  on public.messages
  using (
    thread_giver_id = (select auth.uid())
    or thread_receiver_id = (select auth.uid())
  );

alter policy notifications_delete_for_owner
  on public.notifications
  using (user_id = (select auth.uid()));

alter policy notifications_insert_for_owner
  on public.notifications
  with check (user_id = (select auth.uid()));

alter policy notifications_select_for_owner
  on public.notifications
  using (user_id = (select auth.uid()));

alter policy notifications_update_for_owner
  on public.notifications
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy profiles_insert_for_owner
  on public.profiles
  with check (user_id = (select auth.uid()));

alter policy profiles_select_for_owner
  on public.profiles
  using (user_id = (select auth.uid()));

alter policy profiles_update_for_owner
  on public.profiles
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy reminder_deliveries_select_for_owner
  on public.reminder_deliveries
  using (user_id = (select auth.uid()));

alter policy reminder_jobs_select_for_owner
  on public.reminder_jobs
  using (user_id = (select auth.uid()));

alter policy thread_reads_insert_for_owner
  on public.thread_reads
  with check (user_id = (select auth.uid()));

alter policy thread_reads_select_for_owner
  on public.thread_reads
  using (user_id = (select auth.uid()));

alter policy thread_reads_update_for_owner
  on public.thread_reads
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy wishlists_delete_for_owner
  on public.wishlists
  using (user_id = (select auth.uid()));

alter policy wishlists_insert_for_owner
  on public.wishlists
  with check (
    user_id = (select auth.uid())
    and (select private.is_group_member(group_id))
  );

alter policy wishlists_select_for_owner_or_assigned_giver
  on public.wishlists
  using ((select private.can_view_wishlist(group_id, user_id)));

alter policy wishlists_update_for_owner
  on public.wishlists
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
