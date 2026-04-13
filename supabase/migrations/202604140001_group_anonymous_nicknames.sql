begin;

alter table if exists public.groups
  add column if not exists require_anonymous_nickname boolean not null default false;

do $$
begin
  if to_regclass('public.groups') is not null then
    comment on column public.groups.require_anonymous_nickname is
      'When true, members must choose an alias before joining and group surfaces should prefer nicknames over profile names.';
  end if;
end;
$$;

commit;
