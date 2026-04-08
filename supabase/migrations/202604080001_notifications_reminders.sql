begin;

alter table public.profiles
  add column if not exists reminder_wishlist_incomplete boolean default true,
  add column if not exists reminder_event_tomorrow boolean default true,
  add column if not exists reminder_post_draw boolean default true,
  add column if not exists reminder_delivery_mode text default 'immediate';

update public.profiles
set
  reminder_wishlist_incomplete = coalesce(reminder_wishlist_incomplete, true),
  reminder_event_tomorrow = coalesce(reminder_event_tomorrow, true),
  reminder_post_draw = coalesce(reminder_post_draw, true),
  reminder_delivery_mode = coalesce(reminder_delivery_mode, 'immediate');

alter table public.profiles
  alter column reminder_wishlist_incomplete set default true,
  alter column reminder_wishlist_incomplete set not null,
  alter column reminder_event_tomorrow set default true,
  alter column reminder_event_tomorrow set not null,
  alter column reminder_post_draw set default true,
  alter column reminder_post_draw set not null,
  alter column reminder_delivery_mode set default 'immediate',
  alter column reminder_delivery_mode set not null;

alter table public.profiles
  drop constraint if exists profiles_reminder_delivery_mode_check;

alter table public.profiles
  add constraint profiles_reminder_delivery_mode_check
  check (reminder_delivery_mode in ('immediate', 'daily_digest'));

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null,
  group_id uuid references public.groups(id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  body text not null default '',
  link_path text,
  metadata jsonb not null default '{}'::jsonb,
  candidate_due_at timestamptz not null,
  due_at timestamptz not null,
  next_attempt_at timestamptz,
  delivery_mode_snapshot text not null default 'immediate',
  attempt_count integer not null default 0,
  status text not null default 'pending',
  last_attempt_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reminder_jobs_type_check
    check (reminder_type in ('wishlist_incomplete', 'event_tomorrow', 'post_draw')),
  constraint reminder_jobs_status_check
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  constraint reminder_jobs_delivery_mode_check
    check (delivery_mode_snapshot in ('immediate', 'daily_digest')),
  constraint reminder_jobs_attempt_count_check
    check (attempt_count >= 0),
  constraint reminder_jobs_title_length_check
    check (char_length(trim(title)) between 1 and 120),
  constraint reminder_jobs_body_length_check
    check (char_length(body) <= 240),
  constraint reminder_jobs_link_path_length_check
    check (link_path is null or char_length(link_path) <= 200),
  constraint reminder_jobs_dedupe_key_length_check
    check (char_length(dedupe_key) between 10 and 200)
);

create unique index if not exists reminder_jobs_dedupe_key_key
  on public.reminder_jobs (dedupe_key);

create index if not exists reminder_jobs_due_lookup_idx
  on public.reminder_jobs (status, next_attempt_at);

create index if not exists reminder_jobs_user_status_idx
  on public.reminder_jobs (user_id, status, next_attempt_at desc);

create index if not exists reminder_jobs_group_type_idx
  on public.reminder_jobs (group_id, reminder_type);

alter table public.reminder_jobs enable row level security;

drop policy if exists reminder_jobs_select_for_owner on public.reminder_jobs;
create policy reminder_jobs_select_for_owner
  on public.reminder_jobs
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.reminder_jobs to authenticated;

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_job_id uuid references public.reminder_jobs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null,
  delivery_mode text not null,
  dedupe_key text not null,
  notification_id uuid references public.notifications(id) on delete set null,
  status text not null default 'sent',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  delivered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint reminder_deliveries_type_check
    check (reminder_type in ('wishlist_incomplete', 'event_tomorrow', 'post_draw')),
  constraint reminder_deliveries_mode_check
    check (delivery_mode in ('immediate', 'daily_digest')),
  constraint reminder_deliveries_status_check
    check (status in ('sent', 'failed', 'skipped')),
  constraint reminder_deliveries_dedupe_key_length_check
    check (char_length(dedupe_key) between 10 and 200)
);

create unique index if not exists reminder_deliveries_dedupe_key_key
  on public.reminder_deliveries (dedupe_key);

create index if not exists reminder_deliveries_user_created_idx
  on public.reminder_deliveries (user_id, created_at desc);

create index if not exists reminder_deliveries_job_idx
  on public.reminder_deliveries (reminder_job_id);

alter table public.reminder_deliveries enable row level security;

drop policy if exists reminder_deliveries_select_for_owner on public.reminder_deliveries;
create policy reminder_deliveries_select_for_owner
  on public.reminder_deliveries
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.reminder_deliveries to authenticated;

commit;
