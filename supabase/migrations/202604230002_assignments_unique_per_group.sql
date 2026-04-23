create unique index if not exists assignments_group_giver_unique
  on public.assignments (group_id, giver_id);

create unique index if not exists assignments_group_receiver_unique
  on public.assignments (group_id, receiver_id);
