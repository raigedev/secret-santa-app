create table if not exists public.group_invite_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  constraint group_invite_links_token_length_check
    check (char_length(token) between 20 and 200),
  constraint group_invite_links_revocation_check
    check ((is_active = true and revoked_at is null) or is_active = false)
);

create unique index if not exists group_invite_links_token_key
  on public.group_invite_links(token);

create unique index if not exists group_invite_links_one_active_per_group
  on public.group_invite_links(group_id)
  where is_active = true;

create index if not exists group_invite_links_group_id_idx
  on public.group_invite_links(group_id);

alter table public.group_invite_links enable row level security;

revoke all on table public.group_invite_links from public, anon, authenticated;
grant all on table public.group_invite_links to service_role;
