begin;

-- Remove legacy overlapping policies that remained active alongside the newer
-- security baseline. Postgres treats multiple permissive policies as additive,
-- so leaving the older names in place keeps the weaker access paths alive.
drop policy if exists "Group owners can delete members" on public.group_members;
drop policy if exists "Group owners can insert members" on public.group_members;
drop policy if exists "Logged-in users can create groups" on public.groups;
drop policy if exists "Members can view all assignments when revealed" on public.assignments;
drop policy if exists "Owner can delete own group" on public.groups;
drop policy if exists "Owner can remove members from own group" on public.group_members;
drop policy if exists "Owner can update own group" on public.groups;
drop policy if exists "Owners can delete their groups" on public.groups;
drop policy if exists "Owners can update their groups" on public.groups;
drop policy if exists "Receiver can confirm gift received" on public.assignments;
drop policy if exists "Users can add their own wishlist items" on public.wishlists;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can delete their own wishlist items" on public.wishlists;
drop policy if exists "Users can insert their own read timestamps" on public.thread_reads;
drop policy if exists "Users can only see their own thread messages" on public.messages;
drop policy if exists "Users can see assignments they are part of" on public.assignments;
drop policy if exists "Users can see other profiles display info" on public.profiles;
drop policy if exists "Users can see own items and their recipient items" on public.wishlists;
drop policy if exists "Users can see their own read timestamps" on public.thread_reads;
drop policy if exists "Users can send messages in their own threads" on public.messages;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update their own membership" on public.group_members;
drop policy if exists "Users can update their own read timestamps" on public.thread_reads;
drop policy if exists "Users can update their own wishlist items" on public.wishlists;
drop policy if exists "Users can view own profile" on public.profiles;

-- Membership rows should no longer be updated directly from the browser.
-- Invite claiming, accept/decline, and nickname changes now go through
-- authenticated server actions that verify the actor before using admin writes.
drop policy if exists group_members_update_for_owner_or_self on public.group_members;

-- Keep the current messages insert policy, but require the thread to map to a
-- real assignment so a participant cannot create arbitrary synthetic threads.
drop policy if exists messages_insert_for_thread_participants on public.messages;
create policy messages_insert_for_thread_participants
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (thread_giver_id = auth.uid() or thread_receiver_id = auth.uid())
    and exists (
      select 1
      from public.assignments a
      where a.group_id = messages.group_id
        and a.giver_id = messages.thread_giver_id
        and a.receiver_id = messages.thread_receiver_id
    )
  );

-- This helper was only used by the legacy membership-update policy.
drop function if exists public.get_my_email();

-- Tighten table privileges. Authenticated users keep only the operations the
-- current app actually uses. Anonymous clients get no direct table access.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on table public.groups to authenticated;
grant select, insert, delete on table public.group_members to authenticated;
grant select, update on table public.assignments to authenticated;
grant select, insert, update, delete on table public.wishlists to authenticated;
grant select, insert on table public.messages to authenticated;
grant select, insert, update on table public.thread_reads to authenticated;
grant select, insert, update on table public.profiles to authenticated;

grant execute on function public.current_user_email() to authenticated, service_role;
grant execute on function public.is_group_owner(uuid) to authenticated, service_role;
grant execute on function public.is_group_member(uuid) to authenticated, service_role;
grant execute on function public.is_group_member_or_invited(uuid) to authenticated, service_role;
grant execute on function public.can_view_wishlist(uuid, uuid) to authenticated, service_role;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.write_audit_log(uuid, text, text, text, text, jsonb) to service_role;

-- Prevent future objects from being exposed by default. New public-schema
-- tables/functions should be granted intentionally, not automatically.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

commit;
