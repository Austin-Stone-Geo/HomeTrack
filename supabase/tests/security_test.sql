-- Run with: psql -d <empty test database> -f this-file
-- Prints each check's result. The three ERROR lines near the end are
-- expected: they are a stranger being blocked by the security rules.
\set ON_ERROR_STOP on
\ir _supabase_stubs.sql
\ir ../migrations/20261114000000_initial_schema.sql

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'),  -- Austin
  ('00000000-0000-0000-0000-00000000000b'),  -- partner
  ('00000000-0000-0000-0000-00000000000c');  -- stranger

\unset ON_ERROR_STOP
set role authenticated;

-- Austin creates a household
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.households (name) values ('Denver house') returning name;
select 'spaces seeded' as check, count(*) from public.spaces;
select 'lists seeded' as check, string_agg(name, ', ' order by sort_order) from public.lists;
select 'austin role' as check, role from public.members;
insert into public.items (household_id, space_id, name, quantity)
  select household_id, id, 'Rice', 2 from public.spaces where name = 'Pantry';
select invite_code as code from public.households \gset

-- Stranger sees nothing and cannot write
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select 'stranger sees households' as check, count(*) from public.households;
select 'stranger sees items' as check, count(*) from public.items;
insert into public.items (household_id, space_id, name)
  select h.id, s.id, 'Hack' from (select id from public.households) h, public.spaces s limit 1;
select 'stranger insert into austin household (expect RLS error):' as check;
do $$ begin
  insert into public.spaces (household_id, name)
  values ((select household_id from public.members limit 1), 'x');
end $$;

-- Partner joins with the code
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'partner joined' as check, public.join_household(:'code', 'Partner') is not null;
select 'partner sees items' as check, string_agg(name, ', ') from public.items;
select 'partner role' as check, role from public.members where user_id = auth.uid();
-- Partner tries to promote self to owner (should affect 0 rows or error)
update public.members set role = 'owner' where user_id = auth.uid();
select 'partner role after escalation attempt' as check, role from public.members where user_id = auth.uid();
update public.members set display_name = 'Sam' where user_id = auth.uid();
select 'partner display name' as check, display_name from public.members where user_id = auth.uid();
-- Partner cannot delete household
delete from public.households;
select 'household still exists' as check, count(*) from public.households;
-- Bad invite code
select public.join_household('NOPE1234');
-- Anonymous user cannot join
reset role;
set role anon;
set request.jwt.claim.sub = '';
select 'anon sees households' as check, count(*) from public.households;
