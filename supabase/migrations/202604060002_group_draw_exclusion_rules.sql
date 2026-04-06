begin;

create table if not exists public.group_draw_exclusions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  giver_user_id uuid not null references auth.users(id) on delete cascade,
  receiver_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint group_draw_exclusions_no_self check (giver_user_id <> receiver_user_id)
);

create unique index if not exists group_draw_exclusions_unique_pair
  on public.group_draw_exclusions (group_id, giver_user_id, receiver_user_id);

create index if not exists group_draw_exclusions_group_idx
  on public.group_draw_exclusions (group_id);

alter table public.group_draw_exclusions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_draw_exclusions'
      and policyname = 'group_draw_exclusions_select_for_owner'
  ) then
    create policy group_draw_exclusions_select_for_owner
      on public.group_draw_exclusions
      for select
      to authenticated
      using (public.is_group_owner(group_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_draw_exclusions'
      and policyname = 'group_draw_exclusions_insert_for_owner'
  ) then
    create policy group_draw_exclusions_insert_for_owner
      on public.group_draw_exclusions
      for insert
      to authenticated
      with check (public.is_group_owner(group_id) and created_by = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_draw_exclusions'
      and policyname = 'group_draw_exclusions_delete_for_owner'
  ) then
    create policy group_draw_exclusions_delete_for_owner
      on public.group_draw_exclusions
      for delete
      to authenticated
      using (public.is_group_owner(group_id));
  end if;
end;
$$;

commit;
