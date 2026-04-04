alter table public.affiliate_clicks
  add column if not exists catalog_source text,
  add column if not exists fit_label text,
  add column if not exists tracking_label text,
  add column if not exists resolution_mode text,
  add column if not exists resolution_reason text,
  add column if not exists click_token text;

create index if not exists affiliate_clicks_click_token_idx
  on public.affiliate_clicks (click_token);

create index if not exists affiliate_clicks_merchant_click_token_idx
  on public.affiliate_clicks (merchant, click_token);

create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  merchant text not null check (merchant in ('lazada', 'shopee')),
  affiliate_click_id uuid references public.affiliate_clicks(id) on delete set null,
  click_token text,
  event_type text not null default 'order',
  conversion_status text,
  external_order_id text,
  external_click_id text,
  offer_id text,
  amount numeric(12,2),
  payout numeric(12,2),
  currency text,
  payload_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists affiliate_conversions_payload_hash_key
  on public.affiliate_conversions (payload_hash);

create index if not exists affiliate_conversions_click_token_idx
  on public.affiliate_conversions (click_token);

create index if not exists affiliate_conversions_affiliate_click_id_idx
  on public.affiliate_conversions (affiliate_click_id);

alter table public.affiliate_conversions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_conversions'
      and policyname = 'affiliate_conversions_select_for_owner'
  ) then
    create policy affiliate_conversions_select_for_owner
      on public.affiliate_conversions
      for select
      to authenticated
      using (
        affiliate_click_id is not null
        and exists (
          select 1
          from public.affiliate_clicks
          where affiliate_clicks.id = affiliate_conversions.affiliate_click_id
            and affiliate_clicks.user_id = auth.uid()
        )
      );
  end if;
end;
$$;
