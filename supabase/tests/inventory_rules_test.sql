-- Run with: psql -d <empty test database> -f this-file
-- Prints each check's result. The three ERROR lines near the end are
-- expected: they are a stranger being blocked by the security rules.
\set ON_ERROR_STOP on
\ir _supabase_stubs.sql
\ir ../migrations/20261114000000_initial_schema.sql
\ir ../migrations/20261114010000_inventory_rules.sql
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000c');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.households (name) values ('Denver house');
select id as pantry from public.spaces where name = 'Pantry' \gset
select id as grocery from public.lists where type = 'grocery' \gset

-- Insert without household_id: filled in from the space.
insert into public.items (space_id, name, quantity, min_quantity) values (:'pantry', 'Rice', 3, 1);
insert into public.items (space_id, name, quantity) values (:'pantry', 'Eggs', 12);
select 'household filled' as check, count(*) from public.items where household_id is not null;
select 'grocery empty at start' as check, count(*) from public.list_entries;

-- Eggs run out -> added to groceries
update public.items set quantity = 0 where name = 'Eggs';
-- Rice drops to its minimum -> added
update public.items set quantity = 1 where name = 'Rice';
select 'grocery after running low' as check, string_agg(text, ', ' order by text) from public.list_entries;
-- Further edits while low don't duplicate
update public.items set quantity = 0 where name = 'Rice';
select 'no duplicates' as check, count(*) from public.list_entries;
-- Item inserted already out -> added
insert into public.items (space_id, name, quantity) values (:'pantry', 'Flour', 0);
select 'inserted out item added' as check, count(*) from public.list_entries;

-- Tick off eggs: restocks by 1 (no entry quantity)
select id as eggs_entry from public.list_entries where text = 'Eggs' \gset
update public.list_entries set quantity = 12 where id = :'eggs_entry';
select public.complete_list_entry(:'eggs_entry');
select 'eggs restocked' as check, quantity from public.items where name = 'Eggs';
select 'entry done' as check, done, done_at is not null from public.list_entries where id = :'eggs_entry';
-- Completing twice does nothing more
select public.complete_list_entry(:'eggs_entry');
select 'still 12 eggs' as check, quantity from public.items where name = 'Eggs';
-- Eggs run out again -> a new open entry appears
update public.items set quantity = 0 where name = 'Eggs';
select 'eggs back on list' as check, count(*) from public.list_entries where text = 'Eggs' and not done;

-- To-do list entries don't touch stock
select id as todo from public.lists where type = 'todo' \gset
insert into public.list_entries (list_id, text) values (:'todo', 'Fix the fence');
select public.complete_list_entry(id) from public.list_entries where text = 'Fix the fence';
select 'todo done' as check, done from public.list_entries where text = 'Fix the fence';

-- Activity log
delete from public.items where name = 'Flour';
select 'activity' as check, action, count(*) from public.activity group by action order by action;

-- Stranger can't add to Austin's space or list, or complete entries
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\unset ON_ERROR_STOP
insert into public.items (space_id, name) values (:'pantry', 'Hack');
insert into public.list_entries (list_id, text) values (:'grocery', 'Hack');
select public.complete_list_entry(:'eggs_entry');
\set ON_ERROR_STOP on

-- Owner deletes the household: cascades cleanly
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
delete from public.households;
reset role;
select 'left over rows' as check,
  (select count(*) from public.items) + (select count(*) from public.list_entries)
  + (select count(*) from public.activity) + (select count(*) from public.spaces) as n;
