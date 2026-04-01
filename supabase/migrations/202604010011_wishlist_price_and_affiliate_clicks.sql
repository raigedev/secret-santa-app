alter table public.wishlists
  add column if not exists preferred_price_min numeric(10,2),
  add column if not exists preferred_price_max numeric(10,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wishlists_preferred_price_min_nonnegative_check'
      and conrelid = 'public.wishlists'::regclass
  ) then
    alter table public.wishlists
      add constraint wishlists_preferred_price_min_nonnegative_check
      check (preferred_price_min is null or preferred_price_min >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wishlists_preferred_price_max_nonnegative_check'
      and conrelid = 'public.wishlists'::regclass
  ) then
    alter table public.wishlists
      add constraint wishlists_preferred_price_max_nonnegative_check
      check (preferred_price_max is null or preferred_price_max >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wishlists_preferred_price_bounds_check'
      and conrelid = 'public.wishlists'::regclass
  ) then
    alter table public.wishlists
      add constraint wishlists_preferred_price_bounds_check
      check (
        preferred_price_min is null
        or preferred_price_max is null
        or preferred_price_min <= preferred_price_max
      );
  end if;
end;
$$;

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  group_id uuid not null references public.groups(id) on delete cascade,
  wishlist_item_id uuid not null references public.wishlists(id) on delete cascade,
  merchant text not null check (merchant in ('lazada', 'shopee')),
  suggestion_title text not null,
  search_query text not null,
  target_url text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists affiliate_clicks_user_id_idx
  on public.affiliate_clicks (user_id);

create index if not exists affiliate_clicks_group_id_idx
  on public.affiliate_clicks (group_id);

create index if not exists affiliate_clicks_wishlist_item_id_idx
  on public.affiliate_clicks (wishlist_item_id);

alter table public.affiliate_clicks enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_clicks'
      and policyname = 'affiliate_clicks_select_for_owner'
  ) then
    create policy affiliate_clicks_select_for_owner
      on public.affiliate_clicks
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end;
$$;
