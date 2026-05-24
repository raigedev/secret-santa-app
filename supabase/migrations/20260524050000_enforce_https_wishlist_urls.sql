begin;

update public.wishlists
set item_link = regexp_replace(item_link, '^http://', 'https://', 'i')
where item_link ~* '^http://';

update public.wishlists
set item_image_url = regexp_replace(item_image_url, '^http://', 'https://', 'i')
where item_image_url ~* '^http://';

alter table public.wishlists
  drop constraint if exists wishlists_item_link_protocol_check;

-- Enforce HTTPS on future writes without deleting legacy links during the migration.
alter table public.wishlists
  add constraint wishlists_item_link_protocol_check
  check (
    item_link is null
    or item_link = ''
    or (
      char_length(item_link) <= 500
      and item_link ~* '^https://'
    )
  ) not valid;

alter table public.wishlists
  drop constraint if exists wishlists_item_image_url_protocol_check;

-- Remote images are still normalized on read; this prevents new non-HTTPS values at the database boundary.
alter table public.wishlists
  add constraint wishlists_item_image_url_protocol_check
  check (
    item_image_url is null
    or item_image_url = ''
    or (
      char_length(item_image_url) <= 500
      and item_image_url ~* '^https://'
    )
  ) not valid;

commit;
