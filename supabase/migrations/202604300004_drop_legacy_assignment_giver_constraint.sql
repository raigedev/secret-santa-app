-- Remove a legacy production-only uniqueness constraint that duplicates the
-- durable assignments_group_giver_unique index.
alter table if exists public.assignments
  drop constraint if exists unique_giver_per_group;
