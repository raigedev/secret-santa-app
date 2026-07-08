alter table public.affiliate_conversions
  add column if not exists idempotency_key text;

with ranked_conversions as (
  select
    id,
    merchant,
    payload_hash,
    nullif(lower(btrim(external_order_id)), '') as normalized_external_order_id,
    row_number() over (
      partition by merchant, nullif(lower(btrim(external_order_id)), '')
      order by received_at desc, id
    ) as order_rank
  from public.affiliate_conversions
)
update public.affiliate_conversions as conversions
set idempotency_key = case
  when ranked_conversions.normalized_external_order_id is not null
    and ranked_conversions.order_rank = 1
    then ranked_conversions.merchant || ':order:' || ranked_conversions.normalized_external_order_id
  else ranked_conversions.merchant || ':payload:' || ranked_conversions.payload_hash
end
from ranked_conversions
where conversions.id = ranked_conversions.id
  and conversions.idempotency_key is null;

alter table public.affiliate_conversions
  alter column idempotency_key set not null;

create unique index if not exists affiliate_conversions_idempotency_key_key
  on public.affiliate_conversions (idempotency_key);
