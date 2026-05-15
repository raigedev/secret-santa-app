begin;

create table if not exists public.welcome_email_receipts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  email text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.welcome_email_receipts is
  'Server-owned idempotency receipts for welcome emails. Browser clients must not write this table.';

alter table public.welcome_email_receipts enable row level security;

drop policy if exists welcome_email_receipts_no_client_access on public.welcome_email_receipts;
create policy welcome_email_receipts_no_client_access
  on public.welcome_email_receipts
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on table public.welcome_email_receipts from anon;
revoke all on table public.welcome_email_receipts from authenticated;
grant select, insert, update, delete on table public.welcome_email_receipts to service_role;

-- Browser clients only need to mark notifications as read. Keep server-managed
-- notification metadata and cleanup actions behind trusted server-side code.
revoke update on table public.notifications from authenticated;
revoke delete on table public.notifications from authenticated;
grant update (read_at) on table public.notifications to authenticated;

commit;
