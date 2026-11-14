-- Run with: psql -d <empty test database> -f this-file
-- Prints each check's result. The ERROR lines are expected: they are a kid
-- or a stranger being blocked by the permission rules.
\set ON_ERROR_STOP on
\ir _supabase_stubs.sql
\ir ../migrations/20261114000000_initial_schema.sql
\ir ../migrations/20261114010000_inventory_rules.sql
\ir ../migrations/20261114020000_tasks_and_roles.sql

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'),  -- owner
  ('00000000-0000-0000-0000-00000000000d'),  -- kid
  ('00000000-0000-0000-0000-00000000000c');  -- stranger

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.households (name) values ('Denver house');
select id as hid, invite_code as code from public.households \gset
select id as pantry from public.spaces where name = 'Pantry' \gset
select id as grocery from public.lists where type = 'grocery' \gset
insert into public.items (space_id, name, quantity, min_quantity) values (:'pantry', 'Milk', 1, 0);

-- Tasks: weekly, overdue monthly, one-off
insert into public.tasks (household_id, title, repeat_every, repeat_unit, due_on)
values (:'hid', 'Take out trash', 1, 'week', current_date + 2),
       (:'hid', 'Replace furnace filter', 3, 'month', current_date - 200),
       (:'hid', 'Fix the fence', null, null, current_date);
select 'tasks created' as check, count(*) from public.tasks;

-- Completing early keeps the schedule: due+7
select public.complete_task(id) from public.tasks where title = 'Take out trash';
select 'trash next due' as check, due_on = current_date + 9 as ok from public.tasks where title = 'Take out trash';
-- Long-overdue task jumps to the first date after today
select public.complete_task(id, 'used 16x25x1') from public.tasks where title = 'Replace furnace filter';
select 'filter next due in future' as check, due_on > current_date and due_on <= current_date + 92 as ok
  from public.tasks where title = 'Replace furnace filter';
-- One-off task is retired
select public.complete_task(id) from public.tasks where title = 'Fix the fence';
select 'one-off retired' as check, active from public.tasks where title = 'Fix the fence';
select 'completions logged' as check, count(*), max(notes) from public.task_completions;

-- Bad repeat (every without unit) is rejected
\unset ON_ERROR_STOP
insert into public.tasks (household_id, title, repeat_every) values (:'hid', 'Broken', 2);
\set ON_ERROR_STOP on

-- Kid joins, owner sets them as kid
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select public.join_household(:'code', 'Sam') is not null as joined;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.members set role = 'kid' where display_name = 'Sam';
select 'sam role' as check, role from public.members where display_name = 'Sam';

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select 'kid can see items' as check, count(*) from public.items;
select 'kid can see tasks' as check, count(*) from public.tasks;
-- Kid can add to and tick the grocery list
insert into public.list_entries (list_id, text) values (:'grocery', 'Ice cream');
select public.complete_list_entry(id) from public.list_entries where text = 'Ice cream';
select 'kid ticked entry' as check, done from public.list_entries where text = 'Ice cream';
-- Kid ticks a linked grocery entry: restock works through the function
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update public.items set quantity = 0 where name = 'Milk';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select public.complete_list_entry(id) from public.list_entries where text = 'Milk' and not done;
select 'milk restocked by kid tick' as check, quantity from public.items where name = 'Milk';
-- Kid can do a chore
select public.complete_task(id) from public.tasks where title = 'Take out trash';
select 'kid completed chore' as check, count(*) from public.task_completions
  where user_id = '00000000-0000-0000-0000-00000000000d';
-- Kid cannot change items, tasks, spaces, or remove entries (expect errors / 0 rows)
\unset ON_ERROR_STOP
update public.items set quantity = 99 where name = 'Milk';
select 'milk unchanged by kid' as check, quantity from public.items where name = 'Milk';
insert into public.tasks (household_id, title) values (:'hid', 'Kid task');
insert into public.spaces (household_id, name) values (:'hid', 'Fort');
delete from public.list_entries where text = 'Ice cream';
select 'kid could not remove entry' as check, count(*) from public.list_entries where text = 'Ice cream';
-- Kid cannot promote themselves
update public.members set role = 'adult' where display_name = 'Sam';
select 'kid still kid' as check, role from public.members where display_name = 'Sam';

-- Stranger cannot complete tasks
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.complete_task(id) from (select '00000000-0000-0000-0000-000000000000'::uuid as id) x;
\set ON_ERROR_STOP on
reset role;
select 'stranger completions' as check, count(*) from public.task_completions
  where user_id = '00000000-0000-0000-0000-00000000000c';
