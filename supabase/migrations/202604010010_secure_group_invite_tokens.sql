alter table public.group_invite_links
  add column if not exists token_hash text;

update public.group_invite_links
set token_hash = encode(digest(token, 'sha256'), 'hex')
where token is not null
  and token_hash is null;

drop index if exists group_invite_links_token_key;

alter table public.group_invite_links
  alter column token drop not null;

update public.group_invite_links
set token = null
where token is not null;

create unique index if not exists group_invite_links_token_hash_key
  on public.group_invite_links(token_hash);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_invite_links_token_hash_length_check'
  ) then
    alter table public.group_invite_links
      add constraint group_invite_links_token_hash_length_check
      check (token_hash is not null and char_length(token_hash) = 64);
  end if;
end $$;
