begin;

insert into public.welcome_email_receipts (
  user_id,
  notification_id,
  email,
  sent_at,
  created_at
)
select
  notifications.user_id,
  notifications.id,
  auth_users.email,
  case
    when nullif(notifications.metadata->>'welcomeEmailSentAt', '') ~ '^\d{4}-\d{2}-\d{2}[T ]'
      then (notifications.metadata->>'welcomeEmailSentAt')::timestamptz
    else notifications.created_at
  end as sent_at,
  timezone('utc', now()) as created_at
from public.notifications
inner join auth.users as auth_users
  on auth_users.id = notifications.user_id
where notifications.type = 'welcome'
  and auth_users.email is not null
  and nullif(notifications.metadata->>'welcomeEmailSentAt', '') is not null
on conflict (user_id) do nothing;

commit;
