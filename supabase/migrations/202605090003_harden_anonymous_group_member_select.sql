-- Prevent anonymous groups from exposing peer identity rows through direct
-- group_members table reads. Owners still manage the roster, and members can
-- still read their own row or unclaimed invite row.
drop policy if exists group_members_select_visible_rows on public.group_members;

create policy group_members_select_visible_rows
  on public.group_members
  for select
  to authenticated
  using (
    private.is_group_owner(group_id)
    or user_id = (select auth.uid())
    or (
      user_id is null
      and lower(coalesce(email, '')) = private.current_user_email()
    )
    or (
      private.is_group_member(group_id)
      and exists (
        select 1
        from public.groups g
        where g.id = group_members.group_id
          and coalesce(g.require_anonymous_nickname, false) = false
      )
    )
  );
