-- Extra indexes for the IO-recovery patch. These support bounded chat reads
-- and reminder cron queries that now target current groups and active givers.

create index concurrently if not exists groups_event_date_id_idx
  on public.groups (event_date, id);

create index concurrently if not exists assignments_group_pending_giver_created_idx
  on public.assignments (group_id, giver_id, created_at desc)
  where gift_prep_status is null
    and (gift_received is null or gift_received = false);

create index concurrently if not exists messages_group_thread_created_idx
  on public.messages (group_id, thread_giver_id, thread_receiver_id, created_at desc);

create index concurrently if not exists messages_group_created_idx
  on public.messages (group_id, created_at desc);

create index concurrently if not exists messages_group_sender_idx
  on public.messages (group_id, sender_id);

create index concurrently if not exists thread_reads_user_thread_idx
  on public.thread_reads (user_id, group_id, thread_giver_id, thread_receiver_id);
