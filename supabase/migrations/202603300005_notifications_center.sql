create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link_path text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_for_owner on public.notifications;
create policy notifications_select_for_owner
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_for_owner on public.notifications;
create policy notifications_update_for_owner
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete_for_owner on public.notifications;
create policy notifications_delete_for_owner
  on public.notifications
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, update, delete on table public.notifications to authenticated;
