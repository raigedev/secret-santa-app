-- Restore receiver-side reveal gate for assignment reads.
-- Receivers must not learn giver identity until the group is revealed.
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
