begin;

create table if not exists public.group_draw_cycles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cycle_number integer not null,
  draw_source text not null default 'initial',
  avoid_previous_recipient boolean not null default false,
  repeat_avoidance_relaxed boolean not null default false,
  assignment_count integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint group_draw_cycles_source_check
    check (draw_source in ('initial', 'reroll')),
  constraint group_draw_cycles_assignment_count_check
    check (assignment_count >= 0)
);

create unique index if not exists group_draw_cycles_group_cycle_unique
  on public.group_draw_cycles (group_id, cycle_number);

create index if not exists group_draw_cycles_group_created_idx
  on public.group_draw_cycles (group_id, created_at desc);

alter table public.group_draw_cycles enable row level security;

create table if not exists public.group_draw_cycle_pairs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.group_draw_cycles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  giver_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint group_draw_cycle_pairs_no_self check (giver_id <> receiver_id)
);

create unique index if not exists group_draw_cycle_pairs_unique_giver
  on public.group_draw_cycle_pairs (cycle_id, giver_id);

create unique index if not exists group_draw_cycle_pairs_unique_receiver
  on public.group_draw_cycle_pairs (cycle_id, receiver_id);

create index if not exists group_draw_cycle_pairs_group_idx
  on public.group_draw_cycle_pairs (group_id);

alter table public.group_draw_cycle_pairs enable row level security;

create table if not exists public.group_draw_resets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  assignment_count integer not null default 0,
  confirmed_gift_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint group_draw_resets_reason_length_check
    check (char_length(trim(reason)) between 8 and 300),
  constraint group_draw_resets_assignment_count_check
    check (assignment_count >= 0),
  constraint group_draw_resets_confirmed_count_check
    check (confirmed_gift_count >= 0)
);

create index if not exists group_draw_resets_group_created_idx
  on public.group_draw_resets (group_id, created_at desc);

alter table public.group_draw_resets enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_draw_cycles'
      and policyname = 'group_draw_cycles_select_for_owner'
  ) then
    create policy group_draw_cycles_select_for_owner
      on public.group_draw_cycles
      for select
      to authenticated
      using (public.is_group_owner(group_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_draw_cycle_pairs'
      and policyname = 'group_draw_cycle_pairs_select_for_owner'
  ) then
    create policy group_draw_cycle_pairs_select_for_owner
      on public.group_draw_cycle_pairs
      for select
      to authenticated
      using (public.is_group_owner(group_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_draw_resets'
      and policyname = 'group_draw_resets_select_for_owner'
  ) then
    create policy group_draw_resets_select_for_owner
      on public.group_draw_resets
      for select
      to authenticated
      using (public.is_group_owner(group_id));
  end if;
end;
$$;

commit;
