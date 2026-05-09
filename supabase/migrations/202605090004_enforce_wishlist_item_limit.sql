begin;

create or replace function private.enforce_wishlist_item_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  item_count integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'wishlist-item-limit:' || new.group_id::text || ':' || new.user_id::text,
      0
    )
  );

  select count(*)
  into item_count
  from public.wishlists w
  where w.group_id = new.group_id
    and w.user_id = new.user_id;

  if item_count > 3 then
    raise exception 'Wishlist item limit reached for this group'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_wishlist_item_limit() from public, anon, authenticated;
grant execute on function private.enforce_wishlist_item_limit() to service_role;

drop trigger if exists enforce_wishlist_item_limit_after_insert_or_move on public.wishlists;

create trigger enforce_wishlist_item_limit_after_insert_or_move
  after insert or update of group_id, user_id
  on public.wishlists
  for each row
  execute function private.enforce_wishlist_item_limit();

alter policy wishlists_update_for_owner
  on public.wishlists
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and private.is_group_member(group_id)
  );

commit;
