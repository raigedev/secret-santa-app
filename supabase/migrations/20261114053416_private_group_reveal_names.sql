-- Keep existing memberships nullable and keep the new name server-only.
-- Unlike API grants, a publication without a column list grows with the table.
begin;

alter table public.group_members add column reveal_name text;

revoke select (reveal_name), insert (reveal_name), update (reveal_name)
  on table public.group_members from public, anon, authenticated;
grant select (reveal_name), insert (reveal_name), update (reveal_name)
  on table public.group_members to service_role;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_members'
  ) then
    alter publication supabase_realtime drop table public.group_members;
    alter publication supabase_realtime add table public.group_members
      (id, group_id, user_id, joined_at, nickname, email, role, status);
  end if;
end;
$$;

commit;
