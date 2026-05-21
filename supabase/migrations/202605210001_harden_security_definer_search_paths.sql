begin;

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
set search_path = ''
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

revoke all on function public.list_my_assignment_gift_prep(uuid[]) from public, anon, authenticated;
grant execute on function public.list_my_assignment_gift_prep(uuid[]) to service_role;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.owner_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.status = 'accepted'
      and (
        gm.user_id = (select auth.uid())
        or (
          gm.user_id is null
          and lower(coalesce(gm.email, '')) = public.current_user_email()
        )
      )
  );
$$;

create or replace function public.is_group_member_or_invited(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.status in ('accepted', 'pending')
      and (
        gm.user_id = (select auth.uid())
        or (
          gm.user_id is null
          and lower(coalesce(gm.email, '')) = public.current_user_email()
        )
      )
  );
$$;

create or replace function public.can_view_wishlist(p_group_id uuid, p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.assignments a
      where a.group_id = p_group_id
        and a.giver_id = (select auth.uid())
        and a.receiver_id = p_target_user_id
    );
$$;

do $$
declare
  policy_row record;
  next_check text;
  next_qual text;
  statement text;
begin
  for policy_row in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      p.polname as policy_name,
      pg_get_expr(p.polqual, p.polrelid) as qual,
      pg_get_expr(p.polwithcheck, p.polrelid) as with_check
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        pg_get_expr(p.polqual, p.polrelid) like '%public.%'
        or pg_get_expr(p.polwithcheck, p.polrelid) like '%public.%'
        or pg_get_expr(p.polqual, p.polrelid) ~ '(^|[^[:alnum:]_\.])(current_user_email|is_group_member_or_invited|is_group_member|is_group_owner|can_view_wishlist)\('
        or pg_get_expr(p.polwithcheck, p.polrelid) ~ '(^|[^[:alnum:]_\.])(current_user_email|is_group_member_or_invited|is_group_member|is_group_owner|can_view_wishlist)\('
      )
  loop
    next_qual := policy_row.qual;
    next_check := policy_row.with_check;

    if next_qual is not null then
      next_qual := replace(next_qual, 'public.current_user_email()', 'private.current_user_email()');
      next_qual := replace(next_qual, 'public.is_group_member_or_invited(', 'private.is_group_member_or_invited(');
      next_qual := replace(next_qual, 'public.is_group_member(', 'private.is_group_member(');
      next_qual := replace(next_qual, 'public.is_group_owner(', 'private.is_group_owner(');
      next_qual := replace(next_qual, 'public.can_view_wishlist(', 'private.can_view_wishlist(');
      next_qual := regexp_replace(next_qual, '(^|[^[:alnum:]_\.])current_user_email\(\)', '\1private.current_user_email()', 'g');
      next_qual := regexp_replace(next_qual, '(^|[^[:alnum:]_\.])is_group_member_or_invited\(', '\1private.is_group_member_or_invited(', 'g');
      next_qual := regexp_replace(next_qual, '(^|[^[:alnum:]_\.])is_group_member\(', '\1private.is_group_member(', 'g');
      next_qual := regexp_replace(next_qual, '(^|[^[:alnum:]_\.])is_group_owner\(', '\1private.is_group_owner(', 'g');
      next_qual := regexp_replace(next_qual, '(^|[^[:alnum:]_\.])can_view_wishlist\(', '\1private.can_view_wishlist(', 'g');
    end if;

    if next_check is not null then
      next_check := replace(next_check, 'public.current_user_email()', 'private.current_user_email()');
      next_check := replace(next_check, 'public.is_group_member_or_invited(', 'private.is_group_member_or_invited(');
      next_check := replace(next_check, 'public.is_group_member(', 'private.is_group_member(');
      next_check := replace(next_check, 'public.is_group_owner(', 'private.is_group_owner(');
      next_check := replace(next_check, 'public.can_view_wishlist(', 'private.can_view_wishlist(');
      next_check := regexp_replace(next_check, '(^|[^[:alnum:]_\.])current_user_email\(\)', '\1private.current_user_email()', 'g');
      next_check := regexp_replace(next_check, '(^|[^[:alnum:]_\.])is_group_member_or_invited\(', '\1private.is_group_member_or_invited(', 'g');
      next_check := regexp_replace(next_check, '(^|[^[:alnum:]_\.])is_group_member\(', '\1private.is_group_member(', 'g');
      next_check := regexp_replace(next_check, '(^|[^[:alnum:]_\.])is_group_owner\(', '\1private.is_group_owner(', 'g');
      next_check := regexp_replace(next_check, '(^|[^[:alnum:]_\.])can_view_wishlist\(', '\1private.can_view_wishlist(', 'g');
    end if;

    if next_qual is distinct from policy_row.qual
      or next_check is distinct from policy_row.with_check
    then
      statement := format(
        'alter policy %I on %I.%I',
        policy_row.policy_name,
        policy_row.schema_name,
        policy_row.table_name
      );

      if next_qual is not null then
        statement := statement || format(' using (%s)', next_qual);
      end if;

      if next_check is not null then
        statement := statement || format(' with check (%s)', next_check);
      end if;

      execute statement;
    end if;
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ '(^|[^[:alnum:]_\.])public\.(current_user_email|is_group_member_or_invited|is_group_member|is_group_owner|can_view_wishlist)\('
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '(^|[^[:alnum:]_\.])public\.(current_user_email|is_group_member_or_invited|is_group_member|is_group_owner|can_view_wishlist)\('
        or coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ '(^|[^[:alnum:]_\.])(current_user_email|is_group_member_or_invited|is_group_member|is_group_owner|can_view_wishlist)\('
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ '(^|[^[:alnum:]_\.])(current_user_email|is_group_member_or_invited|is_group_member|is_group_owner|can_view_wishlist)\('
      )
  ) then
    raise exception 'RLS policies still reference public or unqualified auth helper functions.';
  end if;
end;
$$;

revoke all on function public.is_group_owner(uuid) from public, anon, authenticated;
revoke all on function public.is_group_member(uuid) from public, anon, authenticated;
revoke all on function public.is_group_member_or_invited(uuid) from public, anon, authenticated;
revoke all on function public.can_view_wishlist(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_group_owner(uuid) to service_role;
grant execute on function public.is_group_member(uuid) to service_role;
grant execute on function public.is_group_member_or_invited(uuid) to service_role;
grant execute on function public.can_view_wishlist(uuid, uuid) to service_role;

create or replace function public.list_group_peer_profiles(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_emoji text,
  avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_emoji,
    p.avatar_url
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

revoke all on function public.list_group_peer_profiles(uuid) from public, anon, authenticated;
grant execute on function public.list_group_peer_profiles(uuid) to service_role;

create or replace function public.cleanup_security_rate_limits(
  p_keep_seconds integer default 604800
)
returns integer
language plpgsql
security definer
set search_path = ''
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
set search_path = ''
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

create or replace function public.write_audit_log(
  p_actor_user_id uuid,
  p_event_type text,
  p_resource_type text,
  p_resource_id text,
  p_outcome text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := p_actor_user_id;
  v_event_type text := left(trim(coalesce(p_event_type, '')), 120);
  v_resource_type text := left(trim(coalesce(p_resource_type, '')), 80);
  v_resource_id text := nullif(left(trim(coalesce(p_resource_id, '')), 160), '');
  v_outcome text := left(trim(coalesce(p_outcome, '')), 40);
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
begin
  if v_event_type = '' then
    raise exception 'Audit event type is required';
  end if;

  if v_resource_type = '' then
    raise exception 'Audit resource type is required';
  end if;

  if v_outcome not in ('success', 'failure', 'rate_limited') then
    raise exception 'Invalid audit outcome';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if v_actor_user_id is distinct from auth.uid() then
      raise exception 'Audit actor must match auth.uid()';
    end if;
  end if;

  if jsonb_typeof(v_details) is distinct from 'object' then
    v_details := jsonb_build_object('value', v_details);
  end if;

  insert into public.security_audit_logs (
    actor_user_id,
    event_type,
    resource_type,
    resource_id,
    outcome,
    details
  )
  values (
    v_actor_user_id,
    v_event_type,
    v_resource_type,
    v_resource_id,
    v_outcome,
    v_details
  );
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit_log(uuid, text, text, text, text, jsonb) to service_role;

create or replace function private.enforce_wishlist_item_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'wishlist-item-limit:' || new.group_id::text || ':' || new.user_id::text,
      0
    )
  );

  select count(*)
  into item_count
  from public.wishlists w
  where w.group_id = new.group_id
    and w.user_id = new.user_id;

  if item_count > 3 then
    raise exception 'Wishlist item limit reached for this group'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_wishlist_item_limit() from public, anon, authenticated;
grant execute on function private.enforce_wishlist_item_limit() to service_role;

commit;
