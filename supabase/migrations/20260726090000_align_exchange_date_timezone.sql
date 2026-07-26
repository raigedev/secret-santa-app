begin;

-- Exchange dates are calendar dates, not UTC instants. Keep every database
-- policy on the same Philippine-day boundary used by reminders and app code.
create or replace function private.current_exchange_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (timezone('Asia/Manila'::text, now()))::date;
$$;

revoke all on function private.current_exchange_date()
  from public, anon, authenticated;
grant execute on function private.current_exchange_date()
  to authenticated, service_role;

create or replace function private.can_write_group_reveal_session(
  p_group_id uuid,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_group_owner(p_group_id))
    and (
      p_status in ('idle', 'waiting')
      or exists (
        select 1
        from public.groups g
        where g.id = p_group_id
          and (
            g.revealed = true
            or g.event_date <= (select private.current_exchange_date())
          )
      )
    );
$$;

revoke all on function private.can_write_group_reveal_session(uuid, text)
  from public, anon, authenticated;
grant execute on function private.can_write_group_reveal_session(uuid, text)
  to authenticated, service_role;

alter policy group_reveal_sessions_insert_for_owner
  on public.group_reveal_sessions
  with check ((select private.can_write_group_reveal_session(group_id, status)));

alter policy group_reveal_sessions_update_for_owner
  on public.group_reveal_sessions
  using ((select private.is_group_owner(group_id)))
  with check ((select private.can_write_group_reveal_session(group_id, status)));

-- Keep direct browser updates aligned with both the seven-day History boundary
-- and the reveal boundary enforced by server actions.
alter policy groups_update_for_owner
  on public.groups
  using (
    owner_id = (select auth.uid())
    and (
      event_date is null
      or event_date > (select private.current_exchange_date()) - 7
    )
  )
  with check (
    owner_id = (select auth.uid())
    and (
      event_date is null
      or event_date > (select private.current_exchange_date()) - 7
    )
    and (
      revealed = false
      or event_date <= (select private.current_exchange_date())
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
          or writable_group.event_date > (select private.current_exchange_date()) - 7
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
          or writable_group.event_date > (select private.current_exchange_date()) - 7
        )
    )
  );

commit;
