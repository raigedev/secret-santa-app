alter table public.profiles
  drop constraint if exists profiles_avatar_url_storage_owner_check;

alter table public.profiles
  add constraint profiles_avatar_url_storage_owner_check
  check (
    avatar_url is null
    or avatar_url = ''
    or (
      char_length(avatar_url) <= 1000
      and avatar_url ~* (
        '^https://[a-z0-9.-]+\.supabase\.co/storage/v1/object/public/profile-avatars/'
        || user_id::text
        || '/[A-Za-z0-9._~%/-]+$'
      )
    )
  )
  not valid;

alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_merchant_check;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_merchant_check
  check (merchant in ('amazon', 'lazada', 'shopee'));

alter table public.affiliate_conversions
  drop constraint if exists affiliate_conversions_merchant_check;

alter table public.affiliate_conversions
  add constraint affiliate_conversions_merchant_check
  check (merchant in ('amazon', 'lazada', 'shopee'));

drop policy if exists group_draw_cycle_pairs_select_for_owner on public.group_draw_cycle_pairs;

revoke select on table public.group_draw_cycle_pairs from authenticated;
