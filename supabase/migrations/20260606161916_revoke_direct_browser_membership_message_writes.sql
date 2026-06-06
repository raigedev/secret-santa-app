-- Keep browser Data API access read-only for these tables. Membership writes and
-- chat sends must go through server actions so draw-state, capacity, invite
-- acceptance, rate limiting, and notification side effects cannot be bypassed.

revoke insert, delete on table public.group_members from authenticated;
drop policy if exists group_members_insert_for_owner on public.group_members;
drop policy if exists group_members_delete_for_owner_or_self on public.group_members;

revoke insert on table public.messages from authenticated;
drop policy if exists messages_insert_for_thread_participants on public.messages;
