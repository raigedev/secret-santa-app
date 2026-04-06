alter table public.affiliate_clicks
  add column if not exists selected_query text;

update public.affiliate_clicks
set selected_query = left(split_part(coalesce(search_query, ''), ' | ', 1), 200)
where selected_query is null
  and coalesce(search_query, '') <> '';
