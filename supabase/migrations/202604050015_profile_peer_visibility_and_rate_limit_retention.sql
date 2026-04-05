begin;

-- Expose only the minimum profile fields needed for group peer displays.
-- This avoids widening direct SELECT access on profiles while still giving
-- authenticated group owners/members a safe path for names and avatar emoji.
create or replace function public.list_group_peer_profiles(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_emoji text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_emoji
  from public.profiles p
  join public.group_members gm
    on gm.user_id = p.user_id
  where gm.group_id = p_group_id
    and gm.status = 'accepted'
    and (
      public.is_group_owner(p_group_id)
      or public.is_group_member(p_group_id)
    );
$$;

revoke all on function public.list_group_peer_profiles(uuid) from public, anon;
grant execute on function public.list_group_peer_profiles(uuid) to authenticated;
grant execute on function public.list_group_peer_profiles(uuid) to service_role;

-- Keep rate-limit cleanup cheap with a simple created_at index.
create index if not exists security_rate_limits_created_at_idx
  on public.security_rate_limits (created_at);

-- Maintenance helper for old rate-limit rows.
create or replace function public.cleanup_security_rate_limits(
  p_keep_seconds integer default 604800
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_deleted integer := 0;
begin
  v_cutoff := timezone('utc', now()) - make_interval(secs => greatest(p_keep_seconds, 3600));

  delete from public.security_rate_limits
  where created_at < v_cutoff;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_security_rate_limits(integer) from public, anon, authenticated;
grant execute on function public.cleanup_security_rate_limits(integer) to service_role;

-- Opportunistically prune stale rate-limit rows during normal traffic so the
-- table cannot grow forever if no separate cron job is configured yet.
create or replace function public.consume_rate_limit(
  p_action text,
  p_subject text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_window_start timestamptz;
  v_count integer;
  v_oldest_attempt timestamptz;
begin
  if coalesce(trim(p_action), '') = '' or coalesce(trim(p_subject), '') = '' then
    raise exception 'Rate limit action and subject are required';
  end if;

  if p_max_attempts < 1 or p_window_seconds < 1 then
    raise exception 'Rate limit values must be positive';
  end if;

  if random() < 0.02 then
    perform public.cleanup_security_rate_limits(greatest(p_window_seconds * 20, 604800));
  end if;

  v_window_start := v_now - make_interval(secs => p_window_seconds);

  select count(*), min(created_at)
  into v_count, v_oldest_attempt
  from public.security_rate_limits
  where action = p_action
    and subject = p_subject
    and created_at >= v_window_start;

  if v_count >= p_max_attempts then
    return query
    select
      false,
      greatest(
        1,
        ceil(
          extract(
            epoch from ((v_oldest_attempt + make_interval(secs => p_window_seconds)) - v_now)
          )
        )::integer
      ),
      0;
    return;
  end if;

  insert into public.security_rate_limits (action, subject, created_at)
  values (p_action, p_subject, v_now);

  return query
  select
    true,
    0,
    greatest(p_max_attempts - (v_count + 1), 0);
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

commit;
