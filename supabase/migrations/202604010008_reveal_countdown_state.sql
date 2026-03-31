alter table public.group_reveal_sessions
  add column if not exists countdown_started_at timestamptz,
  add column if not exists countdown_seconds integer not null default 0;

alter table public.group_reveal_sessions
  drop constraint if exists group_reveal_sessions_status_check;

alter table public.group_reveal_sessions
  add constraint group_reveal_sessions_status_check
  check (status in ('idle', 'waiting', 'countdown', 'live', 'published'));

alter table public.group_reveal_sessions
  drop constraint if exists group_reveal_sessions_countdown_seconds_check;

alter table public.group_reveal_sessions
  add constraint group_reveal_sessions_countdown_seconds_check
  check (countdown_seconds >= 0 and countdown_seconds <= 30);
