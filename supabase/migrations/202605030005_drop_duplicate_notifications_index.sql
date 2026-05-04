-- Avoid duplicate notification indexes. Keep the original
-- notifications_user_created_at_idx and drop the later identical copy so
-- notification writes maintain one fewer index.
-- Keep committed migrations safe for the Supabase CLI; do not use
-- CONCURRENTLY here because the CLI pipeline rejects it.

drop index if exists public.notifications_user_created_idx;
