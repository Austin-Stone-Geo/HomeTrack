-- HomeTrack v2: recurring tasks and kid permissions
--
-- 1. Tasks get a simple repeat schedule ("every 2 weeks") and a due date.
-- 2. complete_task() logs who did it and moves the task to its next date.
-- 3. Kids can see everything, add to lists, tick lists off and do chores,
--    but only adults (and the owner) can change spaces, items, lists and
--    tasks.

-- ---------------------------------------------------------------------------
-- 1. Repeat schedule
-- ---------------------------------------------------------------------------

alter table public.tasks drop column repeat_rule;
alter table public.tasks drop column next_due_at;

alter table public.tasks
  add column repeat_every int check (repeat_every between 1 and 365),
  add column repeat_unit text check (repeat_unit in ('day', 'week', 'month', 'year')),
  add column due_on date not null default current_date,
  add column notes text,
  add constraint tasks_repeat_both_or_neither
    check ((repeat_every is null) = (repeat_unit is null));

comment on column public.tasks.repeat_every is
  'Repeats every N repeat_units (e.g. 3 + month). Both null means a one-off task.';
comment on column public.tasks.remind_at is
  'Time of day to remind people on the due date. Null means no reminder.';

create index on public.tasks (household_id, active, due_on);

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- True when the signed-in user is an owner or adult in the household.
create function public.is_household_adult(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role in ('owner', 'adult')
  );
$$;

revoke execute on function public.is_household_adult(uuid) from public, anon;
grant execute on function public.is_household_adult(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Complete a task
-- ---------------------------------------------------------------------------

-- Logs the completion and moves a repeating task to its next due date
-- (skipping any dates already in the past). A one-off task is retired.
-- Anyone in the household may complete a task, including kids.
create function public.complete_task(task_id uuid, notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tasks%rowtype;
  next_due date;
  step interval;
begin
  select * into t from public.tasks where id = task_id;
  if t.id is null or not public.is_household_member(t.household_id) then
    raise exception 'Task not found';
  end if;

  insert into public.task_completions (household_id, task_id, user_id, notes)
  values (t.household_id, t.id, auth.uid(), complete_task.notes);

  if t.repeat_every is null then
    update public.tasks set active = false where id = t.id;
    return;
  end if;

  step := make_interval(
    days   => case when t.repeat_unit = 'day'   then t.repeat_every else 0 end,
    weeks  => case when t.repeat_unit = 'week'  then t.repeat_every else 0 end,
    months => case when t.repeat_unit = 'month' then t.repeat_every else 0 end,
    years  => case when t.repeat_unit = 'year'  then t.repeat_every else 0 end
  );
  next_due := (t.due_on + step)::date;
  while next_due <= current_date loop
    next_due := (next_due + step)::date;
  end loop;

  update public.tasks set due_on = next_due where id = t.id;
end;
$$;

revoke execute on function public.complete_task(uuid, text) from public, anon;
grant execute on function public.complete_task(uuid, text) to authenticated;

-- Ticking a grocery entry restocks the item. Kids may tick lists but can't
-- edit items directly, so this now runs with the owner's rights after
-- checking membership itself.
create or replace function public.complete_list_entry(entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
begin
  select le.id, le.household_id, le.item_id, le.quantity, le.done, l.type
  into e
  from public.list_entries le
  join public.lists l on l.id = le.list_id
  where le.id = entry_id;

  if e.id is null or not public.is_household_member(e.household_id) then
    raise exception 'List entry not found';
  end if;
  if e.done then
    return;
  end if;

  update public.list_entries
  set done = true, done_at = now()
  where id = entry_id;

  if e.type = 'grocery' and e.item_id is not null then
    update public.items
    set quantity = quantity + coalesce(e.quantity, 1)
    where id = e.item_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Permissions: everyone reads, adults change things
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  -- Spaces, items, lists and tasks: members read, adults write.
  foreach t in array array['spaces', 'items', 'lists', 'tasks'] loop
    execute format('drop policy "household members have full access" on public.%I', t);
    execute format(
      'create policy "members can view" on public.%I
         for select to authenticated
         using (public.is_household_member(household_id))', t);
    execute format(
      'create policy "adults can add" on public.%I
         for insert to authenticated
         with check (public.is_household_adult(household_id))', t);
    execute format(
      'create policy "adults can change" on public.%I
         for update to authenticated
         using (public.is_household_adult(household_id))
         with check (public.is_household_adult(household_id))', t);
    execute format(
      'create policy "adults can remove" on public.%I
         for delete to authenticated
         using (public.is_household_adult(household_id))', t);
  end loop;
end;
$$;

-- List entries: everyone can add, tick and untick; only adults remove.
drop policy "household members have full access" on public.list_entries;
create policy "members can view" on public.list_entries
  for select to authenticated using (public.is_household_member(household_id));
create policy "members can add" on public.list_entries
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can tick" on public.list_entries
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "adults can remove" on public.list_entries
  for delete to authenticated using (public.is_household_adult(household_id));

-- Task completions are written by complete_task(); members can read them.
drop policy "household members have full access" on public.task_completions;
create policy "members can view" on public.task_completions
  for select to authenticated using (public.is_household_member(household_id));
create policy "adults can remove" on public.task_completions
  for delete to authenticated using (public.is_household_adult(household_id));

alter publication supabase_realtime add table public.task_completions;
