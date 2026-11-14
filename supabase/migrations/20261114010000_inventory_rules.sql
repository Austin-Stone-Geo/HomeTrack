-- HomeTrack v1 inventory rules
--
-- 1. Items and list entries always belong to the same household as their
--    space or list (the app doesn't have to send household_id).
-- 2. When an item runs out or drops to its minimum, it goes onto the
--    household's grocery list automatically.
-- 3. Ticking a grocery entry that is linked to an item restocks that item.
-- 4. Changes to items are written to the activity log.

-- ---------------------------------------------------------------------------
-- 1. Fill in household_id from the parent row
-- ---------------------------------------------------------------------------

create function public.items_set_household()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Runs as the signed-in user, so a space in someone else's household is
  -- invisible here and the insert fails.
  select s.household_id into new.household_id
  from public.spaces s
  where s.id = new.space_id;

  if new.household_id is null then
    raise exception 'Space not found';
  end if;
  return new;
end;
$$;

create trigger items_set_household
  before insert or update of space_id on public.items
  for each row execute function public.items_set_household();

create function public.list_entries_set_household()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select l.household_id into new.household_id
  from public.lists l
  where l.id = new.list_id;

  if new.household_id is null then
    raise exception 'List not found';
  end if;
  return new;
end;
$$;

create trigger list_entries_set_household
  before insert or update of list_id on public.list_entries
  for each row execute function public.list_entries_set_household();

-- ---------------------------------------------------------------------------
-- 2. Low or out items go onto the grocery list
-- ---------------------------------------------------------------------------

-- An item is "low" when it's out, or at or below its minimum.
create function public.item_is_low(quantity numeric, min_quantity numeric)
returns boolean
language sql
immutable
as $$
  select quantity <= 0 or (min_quantity is not null and quantity <= min_quantity);
$$;

create function public.add_low_item_to_grocery_list()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  grocery_list uuid;
begin
  -- Only act when the item has just become low, so removing it from the
  -- list by hand isn't undone by the next small edit.
  if not public.item_is_low(new.quantity, new.min_quantity) then
    return new;
  end if;
  if tg_op = 'UPDATE' and public.item_is_low(old.quantity, old.min_quantity) then
    return new;
  end if;

  select l.id into grocery_list
  from public.lists l
  where l.household_id = new.household_id and l.type = 'grocery'
  order by l.sort_order, l.created_at
  limit 1;

  if grocery_list is null then
    return new;
  end if;

  if not exists (
    select 1 from public.list_entries e
    where e.list_id = grocery_list and e.item_id = new.id and not e.done
  ) then
    insert into public.list_entries (list_id, item_id, text)
    values (grocery_list, new.id, new.name);
  end if;

  return new;
end;
$$;

create trigger items_add_to_grocery_list
  after insert or update of quantity, min_quantity on public.items
  for each row execute function public.add_low_item_to_grocery_list();

-- ---------------------------------------------------------------------------
-- 3. Tick off a list entry, restocking a linked item on grocery lists
-- ---------------------------------------------------------------------------

-- Marks the entry done. If it's on a grocery list and linked to an item,
-- adds the bought amount (the entry's quantity, or 1) to that item.
create function public.complete_list_entry(entry_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  e record;
begin
  select le.id, le.item_id, le.quantity, le.done, l.type
  into e
  from public.list_entries le
  join public.lists l on l.id = le.list_id
  where le.id = entry_id;

  if e.id is null then
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

revoke execute on function public.complete_list_entry(uuid) from public, anon;
grant execute on function public.complete_list_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Activity log
-- ---------------------------------------------------------------------------

create function public.log_item_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity (household_id, item_id, action, details)
    values (new.household_id, new.id, 'added', jsonb_build_object('name', new.name, 'quantity', new.quantity));
  elsif tg_op = 'UPDATE' then
    if new.quantity is distinct from old.quantity then
      insert into public.activity (household_id, item_id, action, details)
      values (new.household_id, new.id, 'quantity changed',
              jsonb_build_object('name', new.name, 'from', old.quantity, 'to', new.quantity));
    end if;
  elsif tg_op = 'DELETE' then
    -- Skip when the whole household is being deleted.
    if exists (select 1 from public.households h where h.id = old.household_id) then
      insert into public.activity (household_id, item_id, action, details)
      values (old.household_id, null, 'removed', jsonb_build_object('name', old.name));
    end if;
    return old;
  end if;
  return new;
end;
$$;

create trigger items_log_activity
  after insert or update of quantity or delete on public.items
  for each row execute function public.log_item_activity();
