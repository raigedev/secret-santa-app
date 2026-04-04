drop view if exists public.affiliate_performance;

create view public.affiliate_performance
with (security_invoker = true)
as
select
  ac.id as affiliate_click_id,
  ac.user_id,
  ac.group_id,
  ac.wishlist_item_id,
  ac.merchant,
  ac.suggestion_title,
  ac.catalog_source,
  ac.fit_label,
  ac.tracking_label,
  ac.resolution_mode,
  ac.resolution_reason,
  ac.search_query,
  ac.target_url,
  ac.click_token,
  ac.created_at as clicked_at,
  conv.id as affiliate_conversion_id,
  conv.event_type,
  conv.conversion_status,
  conv.external_order_id,
  conv.external_click_id,
  conv.offer_id,
  conv.amount,
  conv.payout,
  conv.currency,
  conv.received_at as converted_at
from public.affiliate_clicks ac
left join public.affiliate_conversions conv
  on conv.affiliate_click_id = ac.id
  or (
    conv.affiliate_click_id is null
    and conv.click_token is not null
    and conv.click_token = ac.click_token
  );

revoke all on public.affiliate_performance from public, anon;
grant select on public.affiliate_performance to authenticated;
grant select on public.affiliate_performance to service_role;
