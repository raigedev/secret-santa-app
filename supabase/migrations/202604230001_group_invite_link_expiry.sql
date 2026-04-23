update public.group_invite_links
set expires_at = created_at + interval '7 days'
where expires_at is null;

alter table public.group_invite_links
  alter column expires_at set default timezone('utc', now()) + interval '7 days';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_invite_links_expiry_after_creation_check'
      and conrelid = 'public.group_invite_links'::regclass
  ) then
    alter table public.group_invite_links
      add constraint group_invite_links_expiry_after_creation_check
      check (expires_at > created_at);
  end if;
end $$;
