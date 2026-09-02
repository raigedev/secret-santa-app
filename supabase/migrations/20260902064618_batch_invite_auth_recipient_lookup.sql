begin;

create or replace function public.lookup_invite_auth_recipients(p_emails text[])
returns table (
  normalized_email text,
  user_id uuid,
  can_receive_invite_email boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with requested_emails as (
    select distinct
      pg_catalog.lower(pg_catalog.btrim(requested.email)) as normalized_email
    from pg_catalog.unnest(coalesce(p_emails, '{}'::text[]))
      as requested(email)
    where pg_catalog.char_length(pg_catalog.btrim(requested.email)) between 3 and 100
    limit 50
  ),
  matched_users as (
    select
      requested.normalized_email,
      auth_user.id,
      auth_user.email_confirmed_at,
      auth_user.invited_at,
      auth_user.last_sign_in_at,
      auth_user.created_at
    from requested_emails requested
    join auth.users auth_user
      on auth_user.email = requested.normalized_email
      and auth_user.is_sso_user = false
    where not coalesce(auth_user.is_anonymous, false)

    union all

    select
      requested.normalized_email,
      auth_user.id,
      auth_user.email_confirmed_at,
      auth_user.invited_at,
      auth_user.last_sign_in_at,
      auth_user.created_at
    from requested_emails requested
    join auth.users auth_user
      on pg_catalog.lower(auth_user.email) = requested.normalized_email
      and auth_user.is_sso_user = true
    where auth_user.email is not null
      and not coalesce(auth_user.is_anonymous, false)
  ),
  ranked_users as (
    select
      matched.normalized_email,
      matched.id as user_id,
      (
        matched.invited_at is not null
        and matched.email_confirmed_at is null
        and matched.last_sign_in_at is null
      ) as can_receive_invite_email,
      pg_catalog.row_number() over (
        partition by matched.normalized_email
        order by
          (matched.email_confirmed_at is not null) desc,
          matched.last_sign_in_at desc nulls last,
          matched.created_at asc
      ) as match_rank
    from matched_users matched
  )
  select
    ranked.normalized_email,
    ranked.user_id,
    ranked.can_receive_invite_email
  from ranked_users ranked
  where ranked.match_rank = 1;
$$;

revoke all on function public.lookup_invite_auth_recipients(text[])
  from public, anon, authenticated;
grant execute on function public.lookup_invite_auth_recipients(text[])
  to service_role;

comment on function public.lookup_invite_auth_recipients(text[]) is
  'Looks up normalized invite recipients in one server-only Auth query.';

commit;
