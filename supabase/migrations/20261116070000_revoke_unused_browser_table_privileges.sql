-- Browser roles never need TRUNCATE, TRIGGER, or REFERENCES on app tables or views.
-- The Data API cannot issue these commands, but they are table-level privileges that
-- row-level security does not cover, so remove them as defense in depth.
-- Grant-only change: no data is read, rewritten, or deleted. Safe to run more than once.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
