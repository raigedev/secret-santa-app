create index if not exists group_draw_cycle_pairs_giver_id_idx
  on public.group_draw_cycle_pairs (giver_id);

create index if not exists group_draw_cycle_pairs_receiver_id_idx
  on public.group_draw_cycle_pairs (receiver_id);

create index if not exists group_draw_cycles_created_by_idx
  on public.group_draw_cycles (created_by);

create index if not exists group_draw_exclusions_created_by_idx
  on public.group_draw_exclusions (created_by);

create index if not exists group_draw_exclusions_giver_user_id_idx
  on public.group_draw_exclusions (giver_user_id);

create index if not exists group_draw_exclusions_receiver_user_id_idx
  on public.group_draw_exclusions (receiver_user_id);

create index if not exists group_draw_resets_created_by_idx
  on public.group_draw_resets (created_by);

create index if not exists group_invite_links_created_by_idx
  on public.group_invite_links (created_by);

create index if not exists group_reveal_sessions_started_by_idx
  on public.group_reveal_sessions (started_by);

create index if not exists messages_thread_giver_idx
  on public.messages (thread_giver_id);

create index if not exists messages_thread_receiver_idx
  on public.messages (thread_receiver_id);

create index if not exists messages_sender_idx
  on public.messages (sender_id);

create index if not exists reminder_deliveries_notification_id_idx
  on public.reminder_deliveries (notification_id);

create index if not exists thread_reads_group_id_idx
  on public.thread_reads (group_id);

create index if not exists welcome_email_receipts_notification_id_idx
  on public.welcome_email_receipts (notification_id);
