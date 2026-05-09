-- Keep anonymous Santa chat identifiers out of receiver-side browser reads
-- until the group owner publishes the final reveal.

alter policy messages_select_for_thread_participants
  on public.messages
  using (
    (
      thread_giver_id = (select auth.uid())
      or (
        thread_receiver_id = (select auth.uid())
        and exists (
          select 1
          from public.groups g
          where g.id = messages.group_id
            and g.revealed = true
        )
      )
    )
    and exists (
      select 1
      from public.assignments a
      where a.group_id = messages.group_id
        and a.giver_id = messages.thread_giver_id
        and a.receiver_id = messages.thread_receiver_id
    )
  );

alter policy messages_insert_for_thread_participants
  on public.messages
  with check (
    sender_id = (select auth.uid())
    and (
      thread_giver_id = (select auth.uid())
      or (
        thread_receiver_id = (select auth.uid())
        and exists (
          select 1
          from public.groups g
          where g.id = messages.group_id
            and g.revealed = true
        )
      )
    )
    and exists (
      select 1
      from public.assignments a
      where a.group_id = messages.group_id
        and a.giver_id = messages.thread_giver_id
        and a.receiver_id = messages.thread_receiver_id
    )
  );

alter policy thread_reads_select_for_owner
  on public.thread_reads
  using (
    user_id = (select auth.uid())
    and (
      thread_giver_id = (select auth.uid())
      or (
        thread_receiver_id = (select auth.uid())
        and exists (
          select 1
          from public.groups g
          where g.id = thread_reads.group_id
            and g.revealed = true
        )
      )
    )
    and exists (
      select 1
      from public.assignments a
      where a.group_id = thread_reads.group_id
        and a.giver_id = thread_reads.thread_giver_id
        and a.receiver_id = thread_reads.thread_receiver_id
    )
  );

alter policy thread_reads_insert_for_owner
  on public.thread_reads
  with check (
    user_id = (select auth.uid())
    and (
      thread_giver_id = (select auth.uid())
      or (
        thread_receiver_id = (select auth.uid())
        and exists (
          select 1
          from public.groups g
          where g.id = thread_reads.group_id
            and g.revealed = true
        )
      )
    )
    and exists (
      select 1
      from public.assignments a
      where a.group_id = thread_reads.group_id
        and a.giver_id = thread_reads.thread_giver_id
        and a.receiver_id = thread_reads.thread_receiver_id
    )
  );

alter policy thread_reads_update_for_owner
  on public.thread_reads
  using (
    user_id = (select auth.uid())
    and (
      thread_giver_id = (select auth.uid())
      or (
        thread_receiver_id = (select auth.uid())
        and exists (
          select 1
          from public.groups g
          where g.id = thread_reads.group_id
            and g.revealed = true
        )
      )
    )
    and exists (
      select 1
      from public.assignments a
      where a.group_id = thread_reads.group_id
        and a.giver_id = thread_reads.thread_giver_id
        and a.receiver_id = thread_reads.thread_receiver_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      thread_giver_id = (select auth.uid())
      or (
        thread_receiver_id = (select auth.uid())
        and exists (
          select 1
          from public.groups g
          where g.id = thread_reads.group_id
            and g.revealed = true
        )
      )
    )
    and exists (
      select 1
      from public.assignments a
      where a.group_id = thread_reads.group_id
        and a.giver_id = thread_reads.thread_giver_id
        and a.receiver_id = thread_reads.thread_receiver_id
    )
  );
