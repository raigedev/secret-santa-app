create or replace function public.reset_secret_santa_draw(
  p_group_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_assignment_count integer := 0;
  v_confirmed_gift_count integer := 0;
begin
  if p_group_id is null or p_actor_user_id is null then
    raise exception 'Invalid reset request.'
      using errcode = '22023';
  end if;

  if char_length(v_reason) < 8 or char_length(v_reason) > 300 then
    raise exception 'Reset reason must contain between 8 and 300 characters.'
      using errcode = '22023';
  end if;

  select g.owner_id
  into v_owner_id
  from public.groups as g
  where g.id = p_group_id
  for update;

  if not found then
    raise exception 'Group not found.'
      using errcode = 'P0002';
  end if;

  if v_owner_id is distinct from p_actor_user_id then
    raise exception 'Only the group owner can reset the draw.'
      using errcode = '42501';
  end if;

  select
    count(*)::integer,
    count(*) filter (where a.gift_received)::integer
  into v_assignment_count, v_confirmed_gift_count
  from public.assignments as a
  where a.group_id = p_group_id;

  if v_assignment_count = 0 then
    raise exception 'There is no active draw to reset.'
      using errcode = 'P0002';
  end if;

  delete from public.thread_reads
  where group_id = p_group_id;

  delete from public.messages
  where group_id = p_group_id;

  delete from public.group_reveal_sessions
  where group_id = p_group_id;

  delete from public.assignments
  where group_id = p_group_id;

  update public.groups
  set
    revealed = false,
    revealed_at = null
  where id = p_group_id;

  insert into public.group_draw_resets (
    assignment_count,
    confirmed_gift_count,
    created_by,
    group_id,
    reason
  )
  values (
    v_assignment_count,
    v_confirmed_gift_count,
    p_actor_user_id,
    p_group_id,
    v_reason
  );

  return jsonb_build_object(
    'assignment_count', v_assignment_count,
    'confirmed_gift_count', v_confirmed_gift_count
  );
end;
$$;

revoke all on function public.reset_secret_santa_draw(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reset_secret_santa_draw(uuid, uuid, text)
  to service_role;
