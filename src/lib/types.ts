/**
 * Shapes of the main database rows. These mirror
 * `supabase/migrations/20261114000000_initial_schema.sql`.
 */

export type MemberRole = 'owner' | 'adult' | 'kid';
export type ListType = 'grocery' | 'todo' | 'chores' | 'custom';

export type Household = {
  id: string;
  name: string;
  time_zone: string;
  location: string | null;
  invite_code: string;
  created_at: string;
};

export type Member = {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string | null;
};

export type Space = {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type Item = {
  id: string;
  household_id: string;
  space_id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  min_quantity: number | null;
  expires_on: string | null;
  barcode: string | null;
  photo_path: string | null;
  notes: string | null;
  details: Record<string, unknown>;
  updated_at: string;
};

export type List = {
  id: string;
  household_id: string;
  name: string;
  type: ListType;
  icon: string | null;
  sort_order: number;
};

export type ListEntry = {
  id: string;
  list_id: string;
  item_id: string | null;
  text: string;
  quantity: number | null;
  assigned_to: string | null;
  done: boolean;
};

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

export type Task = {
  id: string;
  household_id: string;
  title: string;
  item_id: string | null;
  space_id: string | null;
  repeat_every: number | null;
  repeat_unit: RepeatUnit | null;
  due_on: string;
  assigned_to: string | null;
  /** Time of day for the reminder, "HH:MM:SS", or null for none. */
  remind_at: string | null;
  active: boolean;
  notes: string | null;
};

export type TaskCompletion = {
  id: string;
  task_id: string;
  user_id: string | null;
  done_at: string;
  notes: string | null;
};
