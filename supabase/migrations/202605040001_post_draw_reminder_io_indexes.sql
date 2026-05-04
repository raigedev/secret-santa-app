-- Support the reminder cron after it starts post-draw work from recent
-- pending assignments instead of scanning every future group first.
-- Keep committed migrations safe for the Supabase CLI; do not use
-- CONCURRENTLY here because the CLI pipeline rejects it.

create index if not exists assignments_pending_created_group_giver_idx
  on public.assignments (created_at desc, group_id, giver_id)
  where gift_prep_status is null
    and (gift_received is null or gift_received = false);

create index if not exists group_draw_cycles_created_group_idx
  on public.group_draw_cycles (created_at desc, group_id, cycle_number desc);
