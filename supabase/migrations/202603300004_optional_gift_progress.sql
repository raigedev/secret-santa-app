begin;

-- Gift prep stays optional, but when users do track it we keep the values
-- constrained to a small set that works for both in-person and flexible handoff flows.
alter table public.assignments
  add column if not exists gift_prep_status text null,
  add column if not exists gift_prep_updated_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignments_gift_prep_status_check'
      and conrelid = 'public.assignments'::regclass
  ) then
    alter table public.assignments
      add constraint assignments_gift_prep_status_check
      check (
        gift_prep_status is null
        or gift_prep_status in ('planning', 'purchased', 'wrapped', 'ready_to_give')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignments_gift_prep_timestamp_check'
      and conrelid = 'public.assignments'::regclass
  ) then
    alter table public.assignments
      add constraint assignments_gift_prep_timestamp_check
      check (gift_prep_updated_at is null or gift_prep_status is not null);
  end if;
end $$;

-- Assignment updates now go through verified server actions with admin writes.
-- Authenticated browser clients keep read access only.
drop policy if exists assignments_update_for_receiver on public.assignments;

revoke update on table public.assignments from authenticated;
grant select on table public.assignments to authenticated;

commit;
