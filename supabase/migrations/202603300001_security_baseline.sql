create extension if not exists pgcrypto;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create table if not exists public.security_rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  subject text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists security_rate_limits_lookup_idx
  on public.security_rate_limits (action, subject, created_at desc);

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  event_type text not null,
  resource_type text not null,
  resource_id text null,
  outcome text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint security_audit_logs_outcome_check
    check (outcome in ('success', 'failure', 'rate_limited'))
);

create index if not exists security_audit_logs_lookup_idx
  on public.security_audit_logs (event_type, created_at desc);

alter table public.security_rate_limits enable row level security;
alter table public.security_audit_logs enable row level security;

revoke all on table public.security_rate_limits from public, anon, authenticated;
revoke all on table public.security_audit_logs from public, anon, authenticated;

drop function if exists public.can_view_wishlist(uuid, uuid) cascade;
drop function if exists public.is_group_member_or_invited(uuid) cascade;
drop function if exists public.is_group_member(uuid) cascade;
drop function if exists public.is_group_owner(uuid) cascade;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.owner_id = auth.uid()
  );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
set search_path = public
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
set search_path = public
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
begin
  insert into public.security_audit_logs (
    actor_user_id,
    event_type,
    resource_type,
    resource_id,
    outcome,
    details
  )
  values (
    p_actor_user_id,
    p_event_type,
    p_resource_type,
    p_resource_id,
    p_outcome,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.write_audit_log(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.write_audit_log(uuid, text, text, text, text, jsonb) to service_role;

do $$
begin
  if to_regclass('public.groups') is not null then
    alter table public.groups enable row level security;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'groups_name_length_check'
        and conrelid = 'public.groups'::regclass
    ) then
      alter table public.groups
        add constraint groups_name_length_check
        check (char_length(btrim(name)) between 1 and 100);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'groups_description_length_check'
        and conrelid = 'public.groups'::regclass
    ) then
      alter table public.groups
        add constraint groups_description_length_check
        check (description is null or char_length(description) <= 300);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'groups_budget_range_check'
        and conrelid = 'public.groups'::regclass
    ) then
      alter table public.groups
        add constraint groups_budget_range_check
        check (budget is null or budget between 0 and 100000);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'groups_currency_allowed_check'
        and conrelid = 'public.groups'::regclass
    ) then
      alter table public.groups
        add constraint groups_currency_allowed_check
        check (
          currency is null
          or upper(currency) in ('USD', 'EUR', 'GBP', 'PHP', 'JPY', 'AUD', 'CAD')
        );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'groups' and policyname = 'groups_select_for_members'
    ) then
      create policy groups_select_for_members
        on public.groups
        for select
        to authenticated
        using (public.is_group_owner(id) or public.is_group_member_or_invited(id));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'groups' and policyname = 'groups_insert_for_owner'
    ) then
      create policy groups_insert_for_owner
        on public.groups
        for insert
        to authenticated
        with check (owner_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'groups' and policyname = 'groups_update_for_owner'
    ) then
      create policy groups_update_for_owner
        on public.groups
        for update
        to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'groups' and policyname = 'groups_delete_for_owner'
    ) then
      create policy groups_delete_for_owner
        on public.groups
        for delete
        to authenticated
        using (owner_id = auth.uid());
    end if;
  end if;

  if to_regclass('public.group_members') is not null then
    alter table public.group_members enable row level security;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'group_members_role_check'
        and conrelid = 'public.group_members'::regclass
    ) then
      alter table public.group_members
        add constraint group_members_role_check
        check (role in ('owner', 'member'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'group_members_status_check'
        and conrelid = 'public.group_members'::regclass
    ) then
      alter table public.group_members
        add constraint group_members_status_check
        check (status in ('pending', 'accepted', 'declined'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'group_members_nickname_length_check'
        and conrelid = 'public.group_members'::regclass
    ) then
      alter table public.group_members
        add constraint group_members_nickname_length_check
        check (nickname is null or char_length(btrim(nickname)) between 1 and 30);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'group_members_email_length_check'
        and conrelid = 'public.group_members'::regclass
    ) then
      alter table public.group_members
        add constraint group_members_email_length_check
        check (email is null or char_length(email) <= 100);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'group_members_identity_check'
        and conrelid = 'public.group_members'::regclass
    ) then
      alter table public.group_members
        add constraint group_members_identity_check
        check (user_id is not null or nullif(btrim(coalesce(email, '')), '') is not null);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_select_visible_rows'
    ) then
      create policy group_members_select_visible_rows
        on public.group_members
        for select
        to authenticated
        using (
          public.is_group_owner(group_id)
          or public.is_group_member(group_id)
          or user_id = auth.uid()
          or lower(coalesce(email, '')) = public.current_user_email()
        );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_insert_for_owner'
    ) then
      create policy group_members_insert_for_owner
        on public.group_members
        for insert
        to authenticated
        with check (public.is_group_owner(group_id));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_update_for_owner_or_self'
    ) then
      create policy group_members_update_for_owner_or_self
        on public.group_members
        for update
        to authenticated
        using (
          public.is_group_owner(group_id)
          or user_id = auth.uid()
          or lower(coalesce(email, '')) = public.current_user_email()
        )
        with check (
          public.is_group_owner(group_id)
          or user_id = auth.uid()
          or lower(coalesce(email, '')) = public.current_user_email()
        );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'group_members' and policyname = 'group_members_delete_for_owner_or_self'
    ) then
      create policy group_members_delete_for_owner_or_self
        on public.group_members
        for delete
        to authenticated
        using (public.is_group_owner(group_id) or user_id = auth.uid());
    end if;
  end if;

  if to_regclass('public.assignments') is not null then
    alter table public.assignments enable row level security;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'assignments_distinct_people_check'
        and conrelid = 'public.assignments'::regclass
    ) then
      alter table public.assignments
        add constraint assignments_distinct_people_check
        check (giver_id <> receiver_id);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'assignments_gift_received_timestamp_check'
        and conrelid = 'public.assignments'::regclass
    ) then
      alter table public.assignments
        add constraint assignments_gift_received_timestamp_check
        check (gift_received_at is null or gift_received = true);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_select_for_participants'
    ) then
      create policy assignments_select_for_participants
        on public.assignments
        for select
        to authenticated
        using (giver_id = auth.uid() or receiver_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_insert_for_owner'
    ) then
      create policy assignments_insert_for_owner
        on public.assignments
        for insert
        to authenticated
        with check (public.is_group_owner(group_id));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_update_for_receiver'
    ) then
      create policy assignments_update_for_receiver
        on public.assignments
        for update
        to authenticated
        using (receiver_id = auth.uid())
        with check (receiver_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_delete_for_owner'
    ) then
      create policy assignments_delete_for_owner
        on public.assignments
        for delete
        to authenticated
        using (public.is_group_owner(group_id));
    end if;
  end if;

  if to_regclass('public.wishlists') is not null then
    alter table public.wishlists enable row level security;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'wishlists_item_name_length_check'
        and conrelid = 'public.wishlists'::regclass
    ) then
      alter table public.wishlists
        add constraint wishlists_item_name_length_check
        check (char_length(btrim(item_name)) between 1 and 100);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'wishlists_item_note_length_check'
        and conrelid = 'public.wishlists'::regclass
    ) then
      alter table public.wishlists
        add constraint wishlists_item_note_length_check
        check (item_note is null or char_length(item_note) <= 200);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'wishlists_item_link_protocol_check'
        and conrelid = 'public.wishlists'::regclass
    ) then
      alter table public.wishlists
        add constraint wishlists_item_link_protocol_check
        check (
          item_link is null
          or char_length(item_link) <= 500
          or item_link = ''
          or item_link ~* '^https?://'
        );
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'wishlists_priority_range_check'
        and conrelid = 'public.wishlists'::regclass
    ) then
      alter table public.wishlists
        add constraint wishlists_priority_range_check
        check (priority between 0 and 10);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'wishlists' and policyname = 'wishlists_select_for_owner_or_assigned_giver'
    ) then
      create policy wishlists_select_for_owner_or_assigned_giver
        on public.wishlists
        for select
        to authenticated
        using (public.can_view_wishlist(group_id, user_id));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'wishlists' and policyname = 'wishlists_insert_for_owner'
    ) then
      create policy wishlists_insert_for_owner
        on public.wishlists
        for insert
        to authenticated
        with check (user_id = auth.uid() and public.is_group_member(group_id));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'wishlists' and policyname = 'wishlists_update_for_owner'
    ) then
      create policy wishlists_update_for_owner
        on public.wishlists
        for update
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'wishlists' and policyname = 'wishlists_delete_for_owner'
    ) then
      create policy wishlists_delete_for_owner
        on public.wishlists
        for delete
        to authenticated
        using (user_id = auth.uid());
    end if;
  end if;

  if to_regclass('public.messages') is not null then
    alter table public.messages enable row level security;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'messages_content_length_check'
        and conrelid = 'public.messages'::regclass
    ) then
      alter table public.messages
        add constraint messages_content_length_check
        check (char_length(btrim(content)) between 1 and 500);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'messages_sender_thread_participant_check'
        and conrelid = 'public.messages'::regclass
    ) then
      alter table public.messages
        add constraint messages_sender_thread_participant_check
        check (sender_id = thread_giver_id or sender_id = thread_receiver_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_select_for_thread_participants'
    ) then
      create policy messages_select_for_thread_participants
        on public.messages
        for select
        to authenticated
        using (thread_giver_id = auth.uid() or thread_receiver_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_insert_for_thread_participants'
    ) then
      create policy messages_insert_for_thread_participants
        on public.messages
        for insert
        to authenticated
        with check (
          sender_id = auth.uid()
          and (thread_giver_id = auth.uid() or thread_receiver_id = auth.uid())
        );
    end if;
  end if;

  if to_regclass('public.thread_reads') is not null then
    alter table public.thread_reads enable row level security;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'thread_reads' and policyname = 'thread_reads_select_for_owner'
    ) then
      create policy thread_reads_select_for_owner
        on public.thread_reads
        for select
        to authenticated
        using (user_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'thread_reads' and policyname = 'thread_reads_insert_for_owner'
    ) then
      create policy thread_reads_insert_for_owner
        on public.thread_reads
        for insert
        to authenticated
        with check (user_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'thread_reads' and policyname = 'thread_reads_update_for_owner'
    ) then
      create policy thread_reads_update_for_owner
        on public.thread_reads
        for update
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    end if;
  end if;

  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_display_name_length_check'
        and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_display_name_length_check
        check (char_length(btrim(display_name)) between 1 and 50);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_bio_length_check'
        and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_bio_length_check
        check (bio is null or char_length(bio) <= 200);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_default_budget_range_check'
        and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_default_budget_range_check
        check (default_budget is null or default_budget between 0 and 10000);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_currency_allowed_check'
        and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_currency_allowed_check
        check (
          currency is null
          or upper(currency) in ('USD', 'EUR', 'GBP', 'PHP', 'JPY', 'AUD', 'CAD')
        );
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_avatar_emoji_length_check'
        and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_avatar_emoji_length_check
        check (avatar_emoji is null or char_length(avatar_emoji) <= 10);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_for_owner'
    ) then
      create policy profiles_select_for_owner
        on public.profiles
        for select
        to authenticated
        using (user_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_for_owner'
    ) then
      create policy profiles_insert_for_owner
        on public.profiles
        for insert
        to authenticated
        with check (user_id = auth.uid());
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_for_owner'
    ) then
      create policy profiles_update_for_owner
        on public.profiles
        for update
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    end if;
  end if;
end $$;
