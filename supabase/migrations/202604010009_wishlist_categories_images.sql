alter table public.wishlists
  add column if not exists item_category text,
  add column if not exists item_image_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wishlists_item_category_check'
  ) then
    alter table public.wishlists
      add constraint wishlists_item_category_check
      check (
        item_category is null or item_category in (
          'Tech',
          'Fashion',
          'Beauty',
          'Food',
          'Books',
          'Games',
          'Home',
          'Collectibles',
          'Experience',
          'Other'
        )
      );
  end if;
end $$;
