-- Cover the remaining bounded reads that sort affiliate conversions and due
-- reminder jobs. These are safe additive indexes for disk-IO recovery.
-- Keep committed migrations safe for the Supabase CLI; do not use
-- CONCURRENTLY here because the CLI pipeline rejects it.

create index if not exists affiliate_conversions_merchant_received_idx
  on public.affiliate_conversions (merchant, received_at desc);

create index if not exists affiliate_conversions_click_received_idx
  on public.affiliate_conversions (affiliate_click_id, received_at desc);

create index if not exists affiliate_clicks_merchant_click_created_idx
  on public.affiliate_clicks (merchant, click_token, created_at desc);

create index if not exists reminder_jobs_processing_due_idx
  on public.reminder_jobs (status, next_attempt_at, due_at)
  where status in ('pending', 'failed');
