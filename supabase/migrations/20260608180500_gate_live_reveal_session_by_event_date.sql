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
            or g.event_date <= (timezone('utc'::text, now()))::date
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
