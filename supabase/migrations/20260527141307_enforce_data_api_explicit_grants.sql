begin;

do $$
declare
  owner_role name;
begin
  foreach owner_role in array array['postgres'::name, 'supabase_admin'::name] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = owner_role) then
      begin
        execute format(
          'alter default privileges for role %I in schema public revoke all privileges on tables from public, anon, authenticated, service_role',
          owner_role
        );
        execute format(
          'alter default privileges for role %I in schema public revoke all privileges on sequences from public, anon, authenticated, service_role',
          owner_role
        );
        execute format(
          'alter default privileges for role %I in schema public revoke all privileges on functions from public, anon, authenticated, service_role',
          owner_role
        );
      exception
        when insufficient_privilege then
          raise notice 'Skipping public-schema default privilege revoke for role % because the migration role cannot alter it.',
            owner_role;
      end;
    end if;
  end loop;
end
$$;

comment on schema public is
  'New public-schema tables, sequences, and functions must opt in to Data API access with explicit grants in migrations.';

commit;
