create table if not exists public.group_reveal_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  status text not null default 'idle',
  current_index integer not null default 0,
  card_revealed boolean not null default false,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  published_at timestamptz,
  last_updated_at timestamptz not null default timezone('utc', now()),
  constraint group_reveal_sessions_group_id_key unique (group_id),
  constraint group_reveal_sessions_status_check
    check (status in ('idle', 'live', 'published')),
  constraint group_reveal_sessions_index_check
    check (current_index >= 0)
);

create index if not exists group_reveal_sessions_group_id_idx
  on public.group_reveal_sessions(group_id);

alter table public.group_reveal_sessions enable row level security;

drop policy if exists group_reveal_sessions_select_for_members on public.group_reveal_sessions;
create policy group_reveal_sessions_select_for_members
  on public.group_reveal_sessions
  for select
  to authenticated
  using (public.is_group_owner(group_id) or public.is_group_member(group_id));

drop policy if exists group_reveal_sessions_insert_for_owner on public.group_reveal_sessions;
create policy group_reveal_sessions_insert_for_owner
  on public.group_reveal_sessions
  for insert
  to authenticated
  with check (public.is_group_owner(group_id));

drop policy if exists group_reveal_sessions_update_for_owner on public.group_reveal_sessions;
create policy group_reveal_sessions_update_for_owner
  on public.group_reveal_sessions
  for update
  to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));

grant select, insert, update on table public.group_reveal_sessions to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'group_reveal_sessions'
  ) then
    alter publication supabase_realtime add table public.group_reveal_sessions;
  end if;
end
$$;
