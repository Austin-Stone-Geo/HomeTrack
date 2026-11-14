-- HomeTrack initial schema
-- Matches the data model in the product spec (v1 tables plus the v2 task tables).
--
-- Every row belongs to a household. Row Level Security (RLS) makes sure a
-- signed-in person can only ever read or change rows for households they are
-- a member of.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'adult', 'kid');
create type public.list_type as enum ('grocery', 'todo', 'chores', 'custom');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  time_zone text not null default 'America/Denver',
  location text,
  -- Short code people type in to join the household.
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'adult',
  display_name text,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text,
  quantity numeric not null default 1 check (quantity >= 0),
  unit text,
  min_quantity numeric check (min_quantity >= 0),
  expires_on date,
  barcode text,
  photo_path text,
  notes text,
  -- Flexible extra details, e.g. a plant's species and light, or a bill's
  -- amount and due day.
  details jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type public.list_type not null default 'custom',
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.list_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  text text not null check (char_length(text) between 1 and 200),
  quantity numeric,
  assigned_to uuid references public.members (id) on delete set null,
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  item_id uuid references public.items (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- v2: recurring tasks and chores. Created now so the model is complete.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  item_id uuid references public.items (id) on delete set null,
  space_id uuid references public.spaces (id) on delete set null,
  -- How often it repeats, as an iCalendar RRULE (e.g. 'FREQ=WEEKLY;BYDAY=TU').
  -- Null means a one-off task.
  repeat_rule text,
  next_due_at timestamptz,
  assigned_to uuid references public.members (id) on delete set null,
  remind_at time,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  done_at timestamptz not null default now(),
  notes text
);

-- Indexes for the lookups the app does most.
create index on public.members (user_id);
create index on public.spaces (household_id);
create index on public.items (household_id, space_id);
create index on public.items (barcode) where barcode is not null;
create index on public.lists (household_id);
create index on public.list_entries (list_id, done);
create index on public.activity (household_id, created_at desc);
create index on public.tasks (household_id, next_due_at);
create index on public.task_completions (task_id, done_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- True when the signed-in user belongs to the household.
create function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

-- True when the signed-in user is the household's owner.
create function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Keep items.updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.touch_updated_at();

-- When someone creates a household: make them the owner and add the starter
-- spaces and lists from the spec.
create function public.setup_new_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.members (household_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;

  insert into public.spaces (household_id, name, icon, sort_order) values
    (new.id, 'Pantry',             'pantry',   10),
    (new.id, 'Fridge and Freezer', 'fridge',   20),
    (new.id, 'Garage',             'garage',   30),
    (new.id, 'Houseplants',        'plant',    40),
    (new.id, 'Gear',               'gear',     50),
    (new.id, 'Tools',              'tools',    60),
    (new.id, 'Bills',              'bill',     70);

  insert into public.lists (household_id, name, type, icon, sort_order) values
    (new.id, 'Groceries', 'grocery', 'cart',  10),
    (new.id, 'To-do',     'todo',    'check', 20);

  return new;
end;
$$;

create trigger households_setup
  after insert on public.households
  for each row execute function public.setup_new_household();

-- Join a household with its invite code. Returns the household id.
create function public.join_household(code text, name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in to join a household';
  end if;

  select h.id into hid
  from public.households h
  where h.invite_code = upper(trim(code));

  if hid is null then
    raise exception 'No household found for that invite code';
  end if;

  insert into public.members (household_id, user_id, role, display_name)
  values (hid, auth.uid(), 'adult', name)
  on conflict (household_id, user_id) do nothing;

  return hid;
end;
$$;

-- Only signed-in users may call the helper functions.
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.is_household_owner(uuid) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.spaces enable row level security;
alter table public.items enable row level security;
alter table public.lists enable row level security;
alter table public.list_entries enable row level security;
alter table public.activity enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

-- Households: members can see theirs, anyone signed in can create one (as
-- themselves), and only the owner can rename or delete it.
create policy "members can view their households" on public.households
  for select to authenticated
  using (public.is_household_member(id) or created_by = auth.uid());
create policy "signed-in users can create a household" on public.households
  for insert to authenticated
  with check (created_by = auth.uid());
create policy "owners can update their household" on public.households
  for update to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));
create policy "owners can delete their household" on public.households
  for delete to authenticated
  using (public.is_household_owner(id));

-- Members: members see each other. New members arrive through the
-- setup trigger or join_household(). Owners manage members; anyone can
-- update their own display name or leave.
create policy "members can view fellow members" on public.members
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "owners can update members" on public.members
  for update to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));
create policy "members can update their own profile" on public.members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (
    select m.role from public.members m where m.id = members.id
  ));
create policy "owners can remove members, anyone can leave" on public.members
  for delete to authenticated
  using (public.is_household_owner(household_id) or user_id = auth.uid());

-- Everything else: full access for members of the household.
do $$
declare
  t text;
begin
  foreach t in array array[
    'spaces', 'items', 'lists', 'list_entries', 'activity', 'tasks', 'task_completions'
  ] loop
    execute format(
      'create policy "household members have full access" on public.%I
         for all to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Live sync: send changes to every open app in the household.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.spaces, public.items, public.lists, public.list_entries, public.tasks;
