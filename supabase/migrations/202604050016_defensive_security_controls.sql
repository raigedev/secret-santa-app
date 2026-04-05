begin;

-- Keep group membership updates server-only. The app already uses admin writes
-- for invite acceptance / decline and owner moderation, so authenticated
-- clients should continue to have no direct UPDATE path here.
drop policy if exists group_members_update_for_owner_or_self on public.group_members;
revoke update on table public.group_members from authenticated;

-- Notifications are created by trusted server-side flows. Add a restrictive
-- self-only insert policy as a safety net, but keep INSERT revoked so normal
-- clients still cannot create notification rows directly.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_insert_for_owner'
  ) then
    create policy notifications_insert_for_owner
      on public.notifications
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end;
$$;

revoke insert on table public.notifications from authenticated;

-- Harden audit logging so a future permission change cannot silently allow
-- actor impersonation or malformed audit rows from authenticated callers.
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
set search_path = public
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

commit;
