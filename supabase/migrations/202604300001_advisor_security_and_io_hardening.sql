begin;

-- Keep helper functions out of the exposed PostgREST RPC surface. RLS policies
-- can still call these private helpers, but clients cannot reach them through
-- /rest/v1/rpc because the private schema is not exposed by PostgREST.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function public.current_user_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function private.current_user_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function private.is_group_owner(p_group_id uuid)
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
      and g.owner_id = auth.uid()
  );
$$;

create or replace function private.is_group_member(p_group_id uuid)
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
        gm.user_id = auth.uid()
        or (
          gm.user_id is null
          and lower(coalesce(gm.email, '')) = private.current_user_email()
        )
      )
  );
$$;

create or replace function private.is_group_member_or_invited(p_group_id uuid)
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
        gm.user_id = auth.uid()
        or (
          gm.user_id is null
          and lower(coalesce(gm.email, '')) = private.current_user_email()
        )
      )
  );
$$;

create or replace function private.can_view_wishlist(
  p_group_id uuid,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_target_user_id = auth.uid()
    or exists (
      select 1
      from public.assignments a
      where a.group_id = p_group_id
        and a.giver_id = auth.uid()
        and a.receiver_id = p_target_user_id
    );
$$;

grant execute on function private.current_user_email() to authenticated, service_role;
grant execute on function private.is_group_owner(uuid) to authenticated, service_role;
grant execute on function private.is_group_member(uuid) to authenticated, service_role;
grant execute on function private.is_group_member_or_invited(uuid) to authenticated, service_role;
grant execute on function private.can_view_wishlist(uuid, uuid) to authenticated, service_role;

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

do $$
begin
  if to_regprocedure('public.current_user_email()') is not null then
    execute 'grant execute on function public.current_user_email() to authenticated, service_role';
  end if;

  if to_regprocedure('public.is_group_owner(uuid)') is not null then
    execute 'revoke all on function public.is_group_owner(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.is_group_owner(uuid) to service_role';
  end if;

  if to_regprocedure('public.is_group_member(uuid)') is not null then
    execute 'revoke all on function public.is_group_member(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.is_group_member(uuid) to service_role';
  end if;

  if to_regprocedure('public.is_group_member_or_invited(uuid)') is not null then
    execute 'revoke all on function public.is_group_member_or_invited(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.is_group_member_or_invited(uuid) to service_role';
  end if;

  if to_regprocedure('public.can_view_wishlist(uuid, uuid)') is not null then
    execute 'revoke all on function public.can_view_wishlist(uuid, uuid) from public, anon, authenticated';
    execute 'grant execute on function public.can_view_wishlist(uuid, uuid) to service_role';
  end if;

  if to_regprocedure('public.list_group_peer_profiles(uuid)') is not null then
    execute 'revoke all on function public.list_group_peer_profiles(uuid) from public, anon, authenticated';
    execute 'grant execute on function public.list_group_peer_profiles(uuid) to service_role';
  end if;
end;
$$;

-- Public buckets serve objects by URL without a broad storage.objects SELECT
-- policy. Dropping this policy prevents clients from listing every avatar file.
drop policy if exists profile_avatars_public_read on storage.objects;

do $$
begin
  if to_regclass('public.group_draw_exclusions') is not null then
    grant select, insert, delete on table public.group_draw_exclusions to authenticated;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_draw_exclusions'
        and policyname = 'group_draw_exclusions_select_for_owner'
    ) then
      create policy group_draw_exclusions_select_for_owner
        on public.group_draw_exclusions
        for select
        to authenticated
        using (private.is_group_owner(group_id));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_draw_exclusions'
        and policyname = 'group_draw_exclusions_insert_for_owner'
    ) then
      create policy group_draw_exclusions_insert_for_owner
        on public.group_draw_exclusions
        for insert
        to authenticated
        with check (private.is_group_owner(group_id) and created_by = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_draw_exclusions'
        and policyname = 'group_draw_exclusions_delete_for_owner'
    ) then
      create policy group_draw_exclusions_delete_for_owner
        on public.group_draw_exclusions
        for delete
        to authenticated
        using (private.is_group_owner(group_id));
    end if;
  end if;

  if to_regclass('public.group_draw_cycles') is not null then
    grant select on table public.group_draw_cycles to authenticated;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_draw_cycles'
        and policyname = 'group_draw_cycles_select_for_owner'
    ) then
      create policy group_draw_cycles_select_for_owner
        on public.group_draw_cycles
        for select
        to authenticated
        using (private.is_group_owner(group_id));
    end if;
  end if;

  if to_regclass('public.group_draw_cycle_pairs') is not null then
    grant select on table public.group_draw_cycle_pairs to authenticated;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_draw_cycle_pairs'
        and policyname = 'group_draw_cycle_pairs_select_for_owner'
    ) then
      create policy group_draw_cycle_pairs_select_for_owner
        on public.group_draw_cycle_pairs
        for select
        to authenticated
        using (private.is_group_owner(group_id));
    end if;
  end if;

  if to_regclass('public.group_draw_resets') is not null then
    grant select on table public.group_draw_resets to authenticated;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_draw_resets'
        and policyname = 'group_draw_resets_select_for_owner'
    ) then
      create policy group_draw_resets_select_for_owner
        on public.group_draw_resets
        for select
        to authenticated
        using (private.is_group_owner(group_id));
    end if;
  end if;

  if to_regclass('public.group_invite_links') is not null then
    revoke all on table public.group_invite_links from public, anon, authenticated;
    grant all on table public.group_invite_links to service_role;

    drop policy if exists group_invite_links_select_for_owner on public.group_invite_links;
    drop policy if exists group_invite_links_insert_for_owner on public.group_invite_links;
    drop policy if exists group_invite_links_update_for_owner on public.group_invite_links;
    drop policy if exists group_invite_links_delete_for_owner on public.group_invite_links;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'group_invite_links'
        and policyname = 'group_invite_links_no_client_access'
    ) then
      create policy group_invite_links_no_client_access
        on public.group_invite_links
        as restrictive
        for all
        to authenticated
        using (false)
        with check (false);
    end if;
  end if;

  if to_regclass('public.security_audit_logs') is not null
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'security_audit_logs'
        and policyname = 'security_audit_logs_no_client_access'
    )
  then
    create policy security_audit_logs_no_client_access
      on public.security_audit_logs
      as restrictive
      for all
      to authenticated
      using (false)
      with check (false);
  end if;

  if to_regclass('public.security_rate_limits') is not null
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'security_rate_limits'
        and policyname = 'security_rate_limits_no_client_access'
    )
  then
    create policy security_rate_limits_no_client_access
      on public.security_rate_limits
      as restrictive
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end;
$$;

commit;
