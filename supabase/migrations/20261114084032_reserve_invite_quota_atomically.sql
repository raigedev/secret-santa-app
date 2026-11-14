begin;

create function public.reserve_group_invite_quota(
  p_actor_id uuid,
  p_group_id uuid,
  p_invite_count integer
)
returns table (allowed boolean, retry_after_seconds integer, remaining integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action constant text := 'group.invite_user';
  v_subject text := p_actor_id::text || ':' || p_group_id::text;
  v_limit constant integer := 15;
  v_window constant interval := interval '1 hour';
  v_now timestamptz;
  v_count integer;
  v_next_attempt timestamptz;
begin
  if v_subject is null or p_invite_count is null or p_invite_count not between 1 and 5 then
    raise exception 'Invalid group invite quota request';
  end if;

  -- Keep the count and the reservation together for each organizer and exchange.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_action || ':' || v_subject, 0));
  v_now := pg_catalog.clock_timestamp();

  select count(*) into v_count
  from public.security_rate_limits
  where action = v_action and subject = v_subject and created_at > v_now - v_window;

  if v_count + p_invite_count > v_limit then
    select created_at into v_next_attempt
    from public.security_rate_limits
    where action = v_action and subject = v_subject and created_at > v_now - v_window
    order by created_at
    offset (v_count + p_invite_count - v_limit - 1)
    limit 1;

    return query select false,
      greatest(1, ceil(extract(epoch from v_next_attempt + v_window - v_now))::integer),
      greatest(v_limit - v_count, 0);
    return;
  end if;

  insert into public.security_rate_limits (action, subject, created_at)
  select v_action, v_subject, v_now
  from pg_catalog.generate_series(1, p_invite_count);

  return query select true, 0, v_limit - v_count - p_invite_count;
end;
$$;

revoke all on function public.reserve_group_invite_quota(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_group_invite_quota(uuid, uuid, integer) to service_role;

commit;
