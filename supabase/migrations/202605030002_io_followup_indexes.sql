-- Follow-up indexes for IO-heavy bounded reads found during the disk-budget review.
-- Keep committed migrations safe for the Supabase CLI; do not use
-- CONCURRENTLY here because the CLI pipeline rejects it.

create index if not exists messages_group_sender_created_idx
  on public.messages (group_id, sender_id, created_at desc);

create index if not exists affiliate_clicks_merchant_created_idx
  on public.affiliate_clicks (merchant, created_at desc);

create index if not exists affiliate_clicks_merchant_catalog_created_idx
  on public.affiliate_clicks (merchant, catalog_source, created_at desc);

create index if not exists affiliate_clicks_merchant_resolution_created_idx
  on public.affiliate_clicks (merchant, resolution_mode, created_at desc);
