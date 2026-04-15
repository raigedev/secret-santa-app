alter table public.affiliate_clicks
  add column if not exists selected_query text;

update public.affiliate_clicks
set selected_query = left(split_part(coalesce(search_query, ''), ' | ', 1), 200)
where selected_query is null
  and coalesce(search_query, '') <> '';

with target_tokens as (
  select
    id,
    coalesce(
      substring(target_url from '[?&]subId6=([^&]+)'),
      substring(target_url from '[?&]sub_id6=([^&]+)')
    ) as target_click_token
  from public.affiliate_clicks
  where merchant = 'lazada'
    and target_url is not null
    and (target_url like '%subId6=%' or target_url like '%sub_id6=%')
)
update public.affiliate_clicks as clicks
set click_token = target_tokens.target_click_token
from target_tokens
where clicks.id = target_tokens.id
  and target_tokens.target_click_token is not null
  and clicks.click_token is distinct from target_tokens.target_click_token;

update public.affiliate_conversions as conversions
set affiliate_click_id = clicks.id
from public.affiliate_clicks as clicks
where conversions.merchant = 'lazada'
  and clicks.merchant = 'lazada'
  and conversions.affiliate_click_id is null
  and conversions.click_token is not null
  and clicks.click_token = conversions.click_token;
