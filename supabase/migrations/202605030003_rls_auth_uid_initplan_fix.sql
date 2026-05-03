-- Reduce per-row RLS overhead on high-traffic app tables.
--
-- Supabase Advisor flags direct auth.uid() calls in policies because they can
-- be re-evaluated for every scanned row. Keep the hardened private helper
-- surface from the advisor cleanup while wrapping auth values in init plans.

begin;

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function public.current_user_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt()) ->> 'email', ''));
$$;

create or replace function private.current_user_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt()) ->> 'email', ''));
$$;

create or replace function private.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.owner_id = (select auth.uid())
  );
$$;

create or replace function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.status = 'accepted'
      and (
        gm.user_id = (select auth.uid())
        or (
          gm.user_id is null
          and lower(coalesce(gm.email, '')) = private.current_user_email()
        )
      )
  );
$$;

create or replace function private.is_group_member_or_invited(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.status in ('accepted', 'pending')
      and (
        gm.user_id = (select auth.uid())
        or (
          gm.user_id is null
          and lower(coalesce(gm.email, '')) = private.current_user_email()
        )
      )
  );
$$;

create or replace function private.can_view_wishlist(
  p_group_id uuid,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.assignments a
      where a.group_id = p_group_id
        and a.giver_id = (select auth.uid())
        and a.receiver_id = p_target_user_id
    );
$$;

grant execute on function private.current_user_email() to authenticated, service_role;
grant execute on function private.is_group_owner(uuid) to authenticated, service_role;
grant execute on function private.is_group_member(uuid) to authenticated, service_role;
grant execute on function private.is_group_member_or_invited(uuid) to authenticated, service_role;
grant execute on function private.can_view_wishlist(uuid, uuid) to authenticated, service_role;
grant execute on function public.current_user_email() to authenticated, service_role;

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
  using (private.is_group_owner(group_id));

alter policy assignments_insert_for_owner
  on public.assignments
  with check (private.is_group_owner(group_id));

alter policy assignments_select_for_participants
  on public.assignments
  using (
    giver_id = (select auth.uid())
    or receiver_id = (select auth.uid())
  );

alter policy group_members_delete_for_owner_or_self
  on public.group_members
  using (
    private.is_group_owner(group_id)
    or user_id = (select auth.uid())
  );

alter policy group_members_insert_for_owner
  on public.group_members
  with check (private.is_group_owner(group_id));

alter policy group_members_select_visible_rows
  on public.group_members
  using (
    private.is_group_owner(group_id)
    or private.is_group_member(group_id)
    or user_id = (select auth.uid())
    or lower(coalesce(email, '')) = private.current_user_email()
  );

alter policy groups_delete_for_owner
  on public.groups
  using (owner_id = (select auth.uid()));

alter policy groups_insert_for_owner
  on public.groups
  with check (owner_id = (select auth.uid()));

alter policy groups_select_for_members
  on public.groups
  using (
    private.is_group_owner(id)
    or private.is_group_member_or_invited(id)
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
    and private.is_group_member(group_id)
  );

alter policy wishlists_select_for_owner_or_assigned_giver
  on public.wishlists
  using (private.can_view_wishlist(group_id, user_id));

alter policy wishlists_update_for_owner
  on public.wishlists
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;
