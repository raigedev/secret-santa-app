-- Concurrent indexes for high-frequency authenticated read paths. Keep these
-- outside an explicit transaction so Postgres can avoid long write locks.

create index concurrently if not exists groups_owner_created_idx
  on public.groups (owner_id, created_at desc);

create index concurrently if not exists group_members_user_status_group_idx
  on public.group_members (user_id, status, group_id);

create index concurrently if not exists group_members_group_status_user_idx
  on public.group_members (group_id, status, user_id);

create index concurrently if not exists assignments_giver_group_idx
  on public.assignments (giver_id, group_id);

create index concurrently if not exists assignments_receiver_group_idx
  on public.assignments (receiver_id, group_id);

create index concurrently if not exists wishlists_user_group_created_idx
  on public.wishlists (user_id, group_id, created_at desc);

create index concurrently if not exists wishlists_group_user_created_idx
  on public.wishlists (group_id, user_id, created_at desc);

create index concurrently if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index concurrently if not exists notifications_user_type_created_idx
  on public.notifications (user_id, type, created_at desc);

create index concurrently if not exists notifications_user_unread_created_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
