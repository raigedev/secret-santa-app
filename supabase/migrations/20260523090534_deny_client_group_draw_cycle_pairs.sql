do $$
begin
  if to_regclass('public.group_draw_cycle_pairs') is not null then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'group_draw_cycle_pairs'
        and policyname = 'group_draw_cycle_pairs_no_client_select'
    ) then
      create policy group_draw_cycle_pairs_no_client_select
        on public.group_draw_cycle_pairs
        for select
        to anon, authenticated
        -- Keep historical draw-pair rows server-only while satisfying the advisor
        -- expectation that every RLS-enabled table has an explicit policy.
        using (false);
    end if;
  end if;
end $$;
