-- Avoid duplicate notification indexes. Keep the original
-- notifications_user_created_at_idx and drop the later identical copy so
-- notification writes maintain one fewer index.

drop index concurrently if exists public.notifications_user_created_idx;
