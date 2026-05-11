-- Keep group member email addresses out of browser-readable direct table
-- selects. Owners that need invite emails use server actions with the service
-- role after an explicit owner check.
revoke select on table public.group_members from authenticated;

grant select (
  id,
  group_id,
  user_id,
  nickname,
  role,
  status
) on table public.group_members to authenticated;
