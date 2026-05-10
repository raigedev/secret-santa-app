create or replace function public.list_my_assignment_gift_prep(p_group_ids uuid[])
returns table (
  group_id uuid,
  receiver_id uuid,
  gift_prep_status text,
  gift_prep_updated_at timestamptz,
  gift_received boolean,
  gift_received_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.group_id,
    a.receiver_id,
    a.gift_prep_status,
    a.gift_prep_updated_at,
    a.gift_received,
    a.gift_received_at
  from public.assignments a
  where a.giver_id = (select auth.uid())
    and a.group_id = any(p_group_ids);
$$;

revoke all on function public.list_my_assignment_gift_prep(uuid[]) from public, anon;
grant execute on function public.list_my_assignment_gift_prep(uuid[]) to authenticated;
grant execute on function public.list_my_assignment_gift_prep(uuid[]) to service_role;

revoke select on table public.assignments from authenticated;
grant select (
  group_id,
  giver_id,
  receiver_id,
  gift_received,
  gift_received_at
) on table public.assignments to authenticated;
