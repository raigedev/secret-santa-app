begin;

create or replace function private.is_valid_exchange_time_zone(p_time_zone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_timezone_names as zone
    where zone.name = p_time_zone
  );
$$;

revoke all on function private.is_valid_exchange_time_zone(text)
  from public, anon, authenticated;
grant execute on function private.is_valid_exchange_time_zone(text)
  to authenticated, service_role;

alter table public.groups
  add column if not exists event_timezone text;

update public.groups
set event_timezone = 'Asia/Manila'
where event_timezone is null
  or not private.is_valid_exchange_time_zone(event_timezone);

alter table public.groups
  alter column event_timezone set default 'Asia/Manila',
  alter column event_timezone set not null;

alter table public.groups
  drop constraint if exists groups_event_timezone_valid;

alter table public.groups
  add constraint groups_event_timezone_valid
  check (private.is_valid_exchange_time_zone(event_timezone));

create or replace function private.current_exchange_date(p_time_zone text)
returns date
language sql
stable
set search_path = ''
as $$
  select (
    timezone(
      case
        when private.is_valid_exchange_time_zone(p_time_zone) then p_time_zone
        else 'Asia/Manila'
      end,
      now()
    )
  )::date;
$$;

revoke all on function private.current_exchange_date(text)
  from public, anon, authenticated;
grant execute on function private.current_exchange_date(text)
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
            or g.event_date <= private.current_exchange_date(g.event_timezone)
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

alter policy groups_update_for_owner
  on public.groups
  using (
    owner_id = (select auth.uid())
    and (
      event_date is null
      or event_date > private.current_exchange_date(event_timezone) - 7
    )
  )
  with check (
    owner_id = (select auth.uid())
    and (
      event_date is null
      or event_date > private.current_exchange_date(event_timezone) - 7
    )
    and (
      revealed = false
      or event_date <= private.current_exchange_date(event_timezone)
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
          or writable_group.event_date >
            private.current_exchange_date(writable_group.event_timezone) - 7
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
          or writable_group.event_date >
            private.current_exchange_date(writable_group.event_timezone) - 7
        )
    )
  );

drop function if exists private.current_exchange_date();

commit;
